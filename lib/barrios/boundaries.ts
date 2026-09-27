import "server-only"

import { arcgisToGeoJSON } from "@terraformer/arcgis"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import centroid from "@turf/centroid"

/**
 * Fetches Sevilla's urban neighborhood (barrio) boundaries from the "Barrios"
 * layer of the SIRD Sevilla post-earthquake dashboard's own ArcGIS Online
 * feature service:
 * https://www.arcgis.com/apps/dashboards/fae212e5ccee4615a6b9401472c651e6
 *
 * This is currently the only municipio in the study area with a published
 * barrio layer — Caicedonia, Zarzal and Roldanillo have no equivalent, so
 * `getBarrioBoundaries` only ever returns Sevilla's neighborhoods. Callers
 * must not assume every municipio is covered.
 *
 * Esri's polygon rings are converted to nested GeoJSON Polygon/MultiPolygon
 * coordinates with @terraformer/arcgis, same as `lib/veredas/boundaries.ts`.
 */

const BARRIOS_QUERY_URL =
  "https://services7.arcgis.com/fHfQ8qeNWagUQB9e/arcgis/rest/services/GeoArmadillos_noeditables/FeatureServer/5/query"

// Neighborhood boundaries change essentially never — cache a week, same as veredas.
const REVALIDATE_SECONDS = 604800

export interface BarrioBoundary {
  id: string
  nombre: string
  municipio: string
  estado: string | null
  /**
   * Field frequency/susceptibility ratings the SIRD dashboard publishes per
   * barrio (flooding and mass-movement) — kept as raw DANE-style labels
   * since this app has no independent methodology to re-derive them.
   */
  frecuenciaInundacion: string | null
  frecuenciaMovimientoMasa: string | null
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

interface EsriFeature {
  attributes: Record<string, string | number | null>
  geometry?: { rings: number[][][] }
}

export async function getBarrioBoundaries(): Promise<BarrioBoundary[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "OBJECTID,Barrio,estado,Frec_inund,Frec_MM",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  })
  const res = await fetch(`${BARRIOS_QUERY_URL}?${params}`, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!res.ok) throw new Error(`ArcGIS query failed (${res.status}): Barrios de Sevilla`)
  const data = await res.json()
  if (data.error) throw new Error(`ArcGIS query error: ${data.error.message ?? JSON.stringify(data.error)}`)
  const features = (data.features ?? []) as EsriFeature[]

  return features
    .filter((f) => f.geometry)
    .map((f) => {
      const geo = arcgisToGeoJSON({ geometry: f.geometry!, attributes: f.attributes }) as {
        geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
      }
      return {
        id: String(f.attributes.OBJECTID),
        nombre: String(f.attributes.Barrio ?? "").trim(),
        municipio: "Sevilla",
        estado: f.attributes.estado ? String(f.attributes.estado) : null,
        frecuenciaInundacion: f.attributes.Frec_inund ? String(f.attributes.Frec_inund) : null,
        frecuenciaMovimientoMasa: f.attributes.Frec_MM ? String(f.attributes.Frec_MM) : null,
        geometry: geo.geometry,
      }
    })
    .filter((b) => b.nombre.length > 0)
}

/**
 * Matches each feature's centroid against Sevilla's barrio polygons via a
 * real point-in-polygon test (not a nearest-place guess) and returns a
 * `codigoManzana → barrio name` map. Manzanas outside Sevilla, or inside
 * Sevilla but landing outside every mapped barrio, get `null` — callers
 * must render a graceful fallback (no label) rather than guessing.
 */
export async function matchManzanasToBarrios<
  F extends { properties: { codigoManzana: string }; geometry: GeoJSON.Geometry },
>(features: F[]): Promise<Map<string, string | null>> {
  const barrios = await getBarrioBoundaries()
  const result = new Map<string, string | null>()
  for (const f of features) {
    if (barrios.length === 0) {
      result.set(f.properties.codigoManzana, null)
      continue
    }
    const c = centroid(f.geometry as GeoJSON.GeoJSON)
    const match = barrios.find((b) => booleanPointInPolygon(c, b.geometry))
    result.set(f.properties.codigoManzana, match?.nombre ?? null)
  }
  return result
}
