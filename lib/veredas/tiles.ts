import "server-only"

/**
 * Fetches and decodes vereda (sub-municipal) administrative boundaries from
 * DANE's "Nivel de referencia veredas" geovisor:
 * https://geoportal.dane.gov.co/geovisores/territorio/nivel-referencia-veredas/
 *
 * That viewer isn't backed by ArcGIS like every other source in this app —
 * it's a custom PHP backend serving Mapbox Vector Tiles (MVT/PBF), with no
 * plain GeoJSON endpoint. Boundary geometry only exists in the tiles, so
 * this module fetches and decodes them directly:
 *
 *   .../vector-tiles/vectortiles2.php?params=capas_geovisores/veredas_2020/
 *     veredas_2020/codigo_ver-nombre_ver-dptompio-nomb_mpio/{z}/{x}/{y}
 *
 * The tile layer's `dptompio` attribute is the 5-digit DIVIPOLA municipio
 * code; `MUNICIPIO_CODES` below restricts decoded features to the study
 * area (76122 Caicedonia, 76736 Sevilla, 76895 Zarzal) since each tile also
 * carries neighboring municipios' veredas.
 *
 * A vereda that straddles a tile boundary is emitted as separate same-id
 * features once per tile it touches — `getVeredaBoundaries` merges those
 * back into one MultiPolygon per vereda code.
 */

import { PbfReader } from "pbf"
import { VectorTile } from "@mapbox/vector-tile"

const TILE_URL_TEMPLATE =
  "https://geoportal.dane.gov.co/laboratorio/serviciosjson/vector-tiles/vectortiles2.php?params=capas_geovisores/veredas_2020/veredas_2020/codigo_ver-nombre_ver-dptompio-nomb_mpio/{z}/{x}/{y}"

const ZOOM = 12

/**
 * Tile x/y range at ZOOM covering the three municipios' combined bounding
 * box (~4.15–4.55°N, 76.25–75.75°W — derived from each municipio's OSM
 * boundary, with margin). Hardcoded rather than computed from a live
 * geocoder at request time since the study area is fixed.
 */
const TILE_X_RANGE = [1180, 1186] as const
const TILE_Y_RANGE = [1996, 2000] as const

const MUNICIPIO_CODES = new Set(["76122", "76736", "76895"]) // Caicedonia, Sevilla, Zarzal

interface RawVeredaFeature {
  codigoVereda: string
  nombre: string
  municipio: string
  /** One polygon ring-set per tile the vereda was decoded from; merged across tiles by caller. */
  polygon: number[][][]
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

/** Flattens a decoded feature's Polygon or MultiPolygon geometry into a flat list of ring-sets (one per polygon part). */
function toPolygonParts(geometry: { type: string; coordinates: unknown }): number[][][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]]
  if (geometry.type === "MultiPolygon") return geometry.coordinates as number[][][][]
  return []
}

async function fetchTile(x: number, y: number): Promise<RawVeredaFeature[]> {
  const url = TILE_URL_TEMPLATE.replace("{z}", String(ZOOM)).replace("{x}", String(x)).replace("{y}", String(y))
  const res = await fetch(url, { next: { revalidate: 604800 } }) // static admin boundaries — cache a week
  // Edge tiles of the bbox can be entirely empty margin outside DANE's tile
  // pyramid; skip them instead of failing the whole fetch over one tile.
  if (!res.ok) return []
  const buf = await res.arrayBuffer()
  if (buf.byteLength === 0) return []

  const tile = new VectorTile(new PbfReader(Buffer.from(buf)))
  const layer = tile.layers["veredas_2020"]
  if (!layer) return []

  const out: RawVeredaFeature[] = []
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i)
    const props = feature.properties as Record<string, string>
    if (!MUNICIPIO_CODES.has(props.dptompio)) continue

    const geo = feature.toGeoJSON(x, y, ZOOM) as { geometry: { type: string; coordinates: unknown } }
    for (const polygon of toPolygonParts(geo.geometry)) {
      out.push({
        codigoVereda: props.id,
        nombre: toTitleCase(props.nombre_ver ?? ""),
        municipio: toTitleCase(props.nomb_mpio ?? ""),
        polygon,
      })
    }
  }
  return out
}

export interface VeredaBoundary {
  codigoVereda: string
  nombre: string
  municipio: string
  /** MultiPolygon coordinate rings, already merged across every tile the vereda spans. */
  polygons: number[][][][]
}

/**
 * Fetches all 35 tiles covering the study area in parallel, decodes each,
 * and merges same-id features (a vereda split across tile boundaries) into
 * one MultiPolygon per vereda.
 */
export async function getVeredaBoundaries(): Promise<VeredaBoundary[]> {
  const tileCoords: Array<[number, number]> = []
  for (let x = TILE_X_RANGE[0]; x <= TILE_X_RANGE[1]; x++) {
    for (let y = TILE_Y_RANGE[0]; y <= TILE_Y_RANGE[1]; y++) {
      tileCoords.push([x, y])
    }
  }

  const tileResults = await Promise.all(tileCoords.map(([x, y]) => fetchTile(x, y)))

  const byId = new Map<string, VeredaBoundary>()
  for (const features of tileResults) {
    for (const f of features) {
      const existing = byId.get(f.codigoVereda)
      if (existing) {
        existing.polygons.push(f.polygon)
      } else {
        byId.set(f.codigoVereda, {
          codigoVereda: f.codigoVereda,
          nombre: f.nombre,
          municipio: f.municipio,
          polygons: [f.polygon],
        })
      }
    }
  }

  return Array.from(byId.values())
}
