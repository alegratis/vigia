import "server-only"

import { arcgisToGeoJSON } from "@terraformer/arcgis"

/**
 * Fetches vereda (sub-municipal) administrative boundaries for the study
 * area — Caicedonia, Sevilla and Zarzal — from two ArcGIS REST sources:
 *
 * - Esri Colombia's "Veredas de Colombia" Datos Abiertos layer
 *   (ags.esri.co) for the rural veredas themselves. This replaced an
 *   earlier version of this module that decoded DANE's raw vector tiles
 *   (geoportal.dane.gov.co/geovisores/territorio/nivel-referencia-veredas)
 *   directly — that tile pyramid's hardcoded x/y range silently clipped
 *   several of Sevilla's easternmost veredas (Maulen, Mira Flores, Peñas
 *   Blancas, San Juan, Tibi) because it was hand-derived from an
 *   approximate bbox rather than the municipio's true extent.
 * - DANE's MGN "Zona Urbana" layer (portalgis.dane.gov.co) for each
 *   municipio's cabecera municipal, filtered to `clas_ccdgo === "1"`
 *   (as opposed to `"2"`, smaller centros poblados/corregimientos) and
 *   surfaced as a synthetic "Casco Urbano" boundary per municipio — the
 *   rural veredas layer has no concept of the urban core at all, so
 *   without this the exposure picker can't represent it.
 *
 * Esri's polygon rings (clockwise outer / counter-clockwise hole, all
 * flattened into one `rings` array) are converted to nested GeoJSON
 * Polygon/MultiPolygon coordinates with @terraformer/arcgis rather than by
 * hand, since correctly re-grouping holes under their outer ring from
 * ring orientation alone is easy to get subtly wrong.
 */

const VEREDAS_QUERY_URL = "https://ags.esri.co/arcgis/rest/services/DatosAbiertos/VEREDAS_2016/MapServer/0/query"
const ZONA_URBANA_QUERY_URL =
  "https://portalgis.dane.gov.co/mparcgis/rest/services/Hosted/Serv_ZonaUrbana_MGN_2025/FeatureServer/1/query"

/** DIVIPOLA municipio codes for the study area: Caicedonia, Sevilla, Zarzal. */
const MUNICIPIO_CODES = ["76122", "76736", "76895"]

// Static admin boundaries change essentially never — cache both sources a week.
const REVALIDATE_SECONDS = 604800

function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

/**
 * Known misspellings in Esri Colombia's "Veredas de Colombia" source data
 * that we correct after title-casing rather than upstream, since it's a
 * third-party ArcGIS layer we don't control. Keyed by the title-cased
 * NOMBRE_VER value.
 */
const VEREDA_NOMBRE_CORRECTIONS: Record<string, string> = {
  Comingales: "Cominales",
}

function correctNombreVereda(nombre: string): string {
  return VEREDA_NOMBRE_CORRECTIONS[nombre] ?? nombre
}

/** Flattens a decoded GeoJSON Polygon/MultiPolygon into this module's flat MultiPolygon ring-set shape. */
function toPolygons(geometry: { type: string; coordinates: unknown }): number[][][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]]
  if (geometry.type === "MultiPolygon") return geometry.coordinates as number[][][][]
  return []
}

export interface VeredaBoundary {
  codigoVereda: string
  nombre: string
  municipio: string
  /**
   * True for the municipio's cabecera municipal ("Casco Urbano") pseudo-vereda,
   * sourced from DANE's zona urbana layer rather than the rural veredas layer.
   */
  esCascoUrbano?: boolean
  /** MultiPolygon coordinate rings, `[lon, lat]` order. */
  polygons: number[][][][]
}

interface EsriFeature {
  attributes: Record<string, string>
  geometry?: { rings: number[][][] }
}

async function queryArcgis(url: string, where: string, outFields: string): Promise<EsriFeature[]> {
  const params = new URLSearchParams({
    where,
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  })
  const res = await fetch(`${url}?${params}`, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!res.ok) throw new Error(`ArcGIS query failed (${res.status}): ${url}`)
  const data = await res.json()
  if (data.error) throw new Error(`ArcGIS query error: ${data.error.message ?? JSON.stringify(data.error)}`)
  return data.features ?? []
}

async function fetchVeredasRurales(): Promise<VeredaBoundary[]> {
  const where = `DPTOMPIO IN (${MUNICIPIO_CODES.map((c) => `'${c}'`).join(",")})`
  const features = await queryArcgis(VEREDAS_QUERY_URL, where, "NOMBRE_VER,NOMB_MPIO,CODIGO_VER,DPTOMPIO")

  return features
    .filter((f) => f.geometry)
    .map((f) => {
      const geo = arcgisToGeoJSON({ geometry: f.geometry!, attributes: f.attributes }) as {
        geometry: { type: string; coordinates: unknown }
      }
      return {
        codigoVereda: f.attributes.CODIGO_VER,
        nombre: correctNombreVereda(toTitleCase(f.attributes.NOMBRE_VER ?? "")),
        municipio: toTitleCase(f.attributes.NOMB_MPIO ?? ""),
        polygons: toPolygons(geo.geometry),
      }
    })
}

async function fetchCascosUrbanos(): Promise<VeredaBoundary[]> {
  // DANE's WAF 500s on a `where` clause combining the IN(...) list with an
  // `clas_ccdgo = '1'` equality check (false-positive injection filter) —
  // fetch every zona urbana feature for the study area's municipios instead
  // and filter to class 1 ("Cabecera municipal", as opposed to 2 "Centro
  // Poblado") client-side.
  const where = `mpio_cdpmp IN (${MUNICIPIO_CODES.map((c) => `'${c}'`).join(",")})`
  const features = await queryArcgis(
    ZONA_URBANA_QUERY_URL,
    where,
    "mpio_cnmbre,mpio_cdpmp,zu_cnmbre,clas_ccdgo",
  )

  return features
    .filter((f) => f.geometry && f.attributes.clas_ccdgo === "1")
    .map((f) => ({
      codigoVereda: `${f.attributes.mpio_cdpmp}-urbano`,
      nombre: "Casco Urbano",
      municipio: toTitleCase(f.attributes.mpio_cnmbre ?? ""),
      esCascoUrbano: true,
      polygons: toPolygons(
        (arcgisToGeoJSON({ geometry: f.geometry!, attributes: f.attributes }) as { geometry: { type: string; coordinates: unknown } })
          .geometry,
      ),
    }))
}

/**
 * Fetches every rural vereda plus one "Casco Urbano" pseudo-vereda per
 * municipio for the study area.
 */
export async function getVeredaBoundaries(): Promise<VeredaBoundary[]> {
  const [veredas, cascosUrbanos] = await Promise.all([fetchVeredasRurales(), fetchCascosUrbanos()])
  return [...veredas, ...cascosUrbanos]
}
