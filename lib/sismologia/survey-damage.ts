import "server-only"

/**
 * Aggregates Sevilla's community field-damage survey (Survey123, published
 * in the same public ArcGIS org as the user's UVGeomatica Experience app)
 * to the barrio level. This is the only privacy-safe way to surface this
 * data: the raw layer carries household addresses and injury/fatality
 * counts, so — per an explicit decision — this module only ever selects
 * `estado_de_la_vivienda_tras_el_s` (housing damage state) plus the point
 * geometry needed for the spatial join, and returns nothing finer than a
 * per-barrio count. Never widen `SURVEY_OUT_FIELDS` to include address,
 * injury, fatality, displacement or other household-level fields.
 *
 * The survey has no `barrio` attribute of its own, so each point is
 * resolved against the org's `Barrios` polygon layer via point-in-polygon
 * — the same centroid/point-in-polygon join technique already used in
 * lib/riesgo-compuesto/incendios-join.ts.
 */

import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon"
import type { BarrioDamageSummary, SismologiaDanosResponse } from "./api-types"

const SERVICE_ROOT = "https://services7.arcgis.com/fHfQ8qeNWagUQB9e/arcgis/rest/services"
const SURVEY_LAYER = `${SERVICE_ROOT}/survey123_5bf7426b88e24ad892bfd2e61c491d77_results/FeatureServer/0`
const BARRIOS_LAYER = `${SERVICE_ROOT}/GeoArmadillos_noeditables/FeatureServer/5`

// Aggregated field reports don't change fast — an hour keeps this responsive without hammering the source.
const REVALIDATE_SECONDS = 3600

interface SurveyPoint {
  estado: string | null
  lat: number
  lon: number
}

interface EsriPointFeature {
  attributes: { estado_de_la_vivienda_tras_el_s: string | null }
  geometry?: { x: number; y: number }
}

async function fetchSurveyPoints(): Promise<SurveyPoint[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "estado_de_la_vivienda_tras_el_s",
    returnGeometry: "true",
    f: "json",
  })
  const res = await fetch(`${SURVEY_LAYER}/query?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) throw new Error(`No se pudo consultar los reportes de daños (${res.status})`)
  const data: { features: EsriPointFeature[] } = await res.json()
  return data.features
    .filter((f) => f.geometry)
    .map((f) => ({
      estado: f.attributes.estado_de_la_vivienda_tras_el_s,
      lat: f.geometry!.y,
      lon: f.geometry!.x,
    }))
}

interface BarrioFeature {
  nombre: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

async function fetchBarrioPolygons(): Promise<BarrioFeature[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "Barrio",
    outSR: "4326",
    f: "geojson",
  })
  const res = await fetch(`${BARRIOS_LAYER}/query?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) throw new Error(`No se pudo consultar los barrios de Sevilla (${res.status})`)
  const data: GeoJSON.FeatureCollection = await res.json()
  return data.features
    .filter((f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
    .map((f) => ({
      nombre: String((f.properties as Record<string, unknown> | null)?.Barrio ?? "Sin nombre"),
      geometry: f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
    }))
}

/**
 * Fetches and aggregates the Sevilla damage survey to barrio level. Returns
 * a zero-report response (not an error) if either source fails, since this
 * overlay is optional context on top of the main seismic event map.
 */
export async function getSismologiaDanos(): Promise<SismologiaDanosResponse> {
  const [points, barrios] = await Promise.all([
    fetchSurveyPoints().catch(() => [] as SurveyPoint[]),
    fetchBarrioPolygons().catch(() => [] as BarrioFeature[]),
  ])

  const counts = new Map<string, BarrioDamageSummary>()
  let sinBarrio = 0

  for (const p of points) {
    const match = barrios.find((b) => booleanPointInPolygon([p.lon, p.lat], b.geometry))
    if (!match) {
      sinBarrio++
      continue
    }
    const existing = counts.get(match.nombre) ?? { barrio: match.nombre, totalReportes: 0, porEstado: {} }
    existing.totalReportes++
    const estadoKey = p.estado ?? "Sin especificar"
    existing.porEstado[estadoKey] = (existing.porEstado[estadoKey] ?? 0) + 1
    counts.set(match.nombre, existing)
  }

  const barriosSummary = Array.from(counts.values()).sort((a, b) => b.totalReportes - a.totalReportes)

  return {
    generatedAt: new Date().toISOString(),
    municipio: "Sevilla",
    totalReportes: points.length,
    sinBarrio,
    barrios: barriosSummary,
  }
}
