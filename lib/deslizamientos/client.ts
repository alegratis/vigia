import "server-only"

/**
 * Client for RED LabOT's landslide susceptibility index, published on
 * ArcGIS Online as two parallel layers covering Sevilla and Caicedonia — the
 * study area's hillside municipalities; Zarzal sits on the flat valley floor
 * and has no zones in the source layer. Both open, CORS-enabled FeatureServer
 * layers, no auth needed, same publishing pattern GEOGLOWS uses for the flood
 * layer (lib/geoglows/live-map.ts):
 *
 * - `VIGIA_Amenaza_IS_Puntos`: 11,721 points, same attributes as the polygon
 *   layer below but without geometry rings — used for the map visual
 *   (rendered as canvas dots) since the full polygon geometry is too heavy
 *   for Leaflet to render as individual SVG paths at this feature count.
 * - `VIGIA_Amenaza_IS_Poligonos`: same 11,721 records with polygon geometry —
 *   used only for server-side aggregate stats (population + exposure sums by
 *   level), never downloaded whole.
 *
 * Both replace the older, coarser `amenaza_por_deslizamiento` (10 polygons)
 * and `DensityMaps_In` (population-density grid) layers: this index already
 * carries real population, school, hospital, pharmacy and critical
 * infrastructure counts per feature, so a separate population grid is no
 * longer needed.
 *
 * `IS_nivel` here is upper snake case (`MUY_ALTO`, `ALTO`, ...) — every
 * function below normalizes to the app's title-case SusceptibilityLevel
 * scheme via `normalizeSusceptibilityLevel` before returning.
 *
 * Docs: https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/VIGIA_Amenaza_IS_Puntos/FeatureServer
 */

import type {
  ExposureByLevel,
  PopulationByLevel,
  SusceptibilityFeatureCollection,
} from "./api-types"
import { normalizeSusceptibilityLevel, SUSCEPTIBILITY_LEVELS, type SusceptibilityLevel } from "./levels"

const SERVICE_ROOT = "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services"
const POINTS_LAYER = `${SERVICE_ROOT}/VIGIA_Amenaza_IS_Puntos/FeatureServer/0`
const POLYGONS_LAYER = `${SERVICE_ROOT}/VIGIA_Amenaza_IS_Poligonos/FeatureServer/0`

/** ArcGIS Online caps `resultRecordCount` at 2000 per query; the layer has ~11,721 records. */
const PAGE_SIZE = 2000

/**
 * Fetches every susceptibility point (~11,721) as ready-to-render GeoJSON in
 * WGS84, paginating past ArcGIS's 2000-record cap. Only `municipio` and
 * `IS_nivel` are requested — the exposure attributes are surfaced through
 * `getExposureByLevel` instead, aggregated server-side.
 */
export async function getSusceptibilityPoints(): Promise<SusceptibilityFeatureCollection> {
  const features: SusceptibilityFeatureCollection["features"] = []
  let offset = 0

  // The layer's exact count isn't known ahead of time, so page until a
  // response comes back with fewer than a full page.
  while (true) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "municipio,IS_nivel",
      outSR: "4326",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: "geojson",
    })
    const res = await fetch(`${POINTS_LAYER}/query?${params.toString()}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      throw new Error("No se pudo consultar la capa de susceptibilidad a deslizamientos")
    }
    const page = (await res.json()) as SusceptibilityFeatureCollection
    for (const feature of page.features) {
      const level = normalizeSusceptibilityLevel(feature.properties.IS_nivel)
      if (!level) continue
      features.push({
        ...feature,
        properties: { ...feature.properties, IS_nivel: level },
      })
    }
    if (page.features.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { type: "FeatureCollection", features }
}

export interface SusceptibilityPointFull {
  lat: number
  lon: number
  /** Title-cased municipio name ("Sevilla", "Caicedonia") — see the normalization note in `getWorstLevelByMunicipio`. */
  municipio: string
  level: SusceptibilityLevel
  isScore: number | null
  pobGen: number
  pobMen5: number
  pobMay60: number
  nEscuelas: number
  nHospit: number
  nFarmaci: number
  infraCrit: number
}

function titleCaseMunicipio(raw: string): string {
  return raw.charAt(0) + raw.slice(1).toLowerCase()
}

/**
 * Fetches every susceptibility point (~11,721) with its full attribute set
 * (score, population, and critical-infrastructure counts, plus its own
 * `lon`/`lat` attribute fields — already WGS84, so no geometry parsing is
 * needed) for server-side spatial aggregation onto vereda boundaries. See
 * lib/veredas/aggregate.ts, the only caller: it point-in-polygon tests each
 * point against a vereda's boundary and sums these same population/infra
 * fields that `getPopulationByLevel`/`getExposureByLevel` already sum by
 * threat level, just grouped by vereda instead.
 *
 * Only covers Sevilla and Caicedonia — Zarzal has no records in this layer
 * (see the module doc comment), so its veredas simply get no aggregate.
 */
export async function getSusceptibilityPointsForAggregation(): Promise<SusceptibilityPointFull[]> {
  const points: SusceptibilityPointFull[] = []
  let offset = 0

  while (true) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields:
        "municipio,IS_nivel,IS_score,pob_gen,pob_men5,pob_may60,n_escuelas,n_hospit,n_farmaci,infra_crit,lon,lat",
      returnGeometry: "false",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: "json",
    })
    const res = await fetch(`${POINTS_LAYER}/query?${params.toString()}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      throw new Error("No se pudo consultar la capa de susceptibilidad a deslizamientos")
    }
    const json = await res.json()
    const rawFeatures = (json.features ?? []) as Array<{ attributes: Record<string, number | string | null> }>

    for (const f of rawFeatures) {
      const a = f.attributes
      const level = normalizeSusceptibilityLevel(a.IS_nivel != null ? String(a.IS_nivel) : null)
      if (!level || typeof a.lat !== "number" || typeof a.lon !== "number" || typeof a.municipio !== "string") {
        continue
      }
      points.push({
        lat: a.lat,
        lon: a.lon,
        municipio: titleCaseMunicipio(a.municipio),
        level,
        isScore: typeof a.IS_score === "number" ? a.IS_score : null,
        pobGen: Number(a.pob_gen) || 0,
        pobMen5: Number(a.pob_men5) || 0,
        pobMay60: Number(a.pob_may60) || 0,
        nEscuelas: Number(a.n_escuelas) || 0,
        nHospit: Number(a.n_hospit) || 0,
        nFarmaci: Number(a.n_farmaci) || 0,
        infraCrit: Number(a.infra_crit) || 0,
      })
    }
    if (rawFeatures.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return points
}

/**
 * Fetches the worst (highest) susceptibility level present per municipality,
 * for the demografía exposure summary. Skips geometry and asks the server to
 * distinct the municipio/IS_nivel pairs instead of paginating all ~11,721
 * records — the same "let the server aggregate" approach as
 * `getPopulationByLevel`. Municipalities absent from the layer (Zarzal,
 * which sits on the flat valley floor) simply don't appear in the result.
 */
export async function getWorstLevelByMunicipio(): Promise<Map<string, SusceptibilityLevel>> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "municipio,IS_nivel",
    returnGeometry: "false",
    returnDistinctValues: "true",
    f: "json",
  })
  const res = await fetch(`${POLYGONS_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la capa de susceptibilidad a deslizamientos")
  }
  const json = await res.json()
  const rawFeatures = (json.features ?? []) as Array<{
    attributes: { municipio?: string; IS_nivel?: string }
  }>

  const worstByMunicipio = new Map<string, SusceptibilityLevel>()
  for (const f of rawFeatures) {
    const rawMunicipio = f.attributes.municipio
    const level = normalizeSusceptibilityLevel(f.attributes.IS_nivel)
    if (!rawMunicipio || !level) continue
    // The layer stores municipio names upper-cased (e.g. "SEVILLA"); the
    // DANE population data this gets cross-referenced against uses title
    // case ("Sevilla"), so normalize here rather than in every caller.
    const municipio = titleCaseMunicipio(rawMunicipio)
    const current = worstByMunicipio.get(municipio)
    if (!current || SUSCEPTIBILITY_LEVELS.indexOf(level) > SUSCEPTIBILITY_LEVELS.indexOf(current)) {
      worstByMunicipio.set(municipio, level)
    }
  }
  return worstByMunicipio
}

/**
 * Sums population fields (`pob_gen`, `pob_men5`, `pob_may60`) grouped by
 * landslide threat level via a server-side statistics query against the
 * polygon layer, avoiding a client download of all ~11,721 records.
 */
export async function getPopulationByLevel(): Promise<PopulationByLevel[]> {
  const outStatistics = [
    { statisticType: "sum", onStatisticField: "pob_gen", outStatisticFieldName: "total_sum" },
    { statisticType: "sum", onStatisticField: "pob_men5", outStatisticFieldName: "children_sum" },
    { statisticType: "sum", onStatisticField: "pob_may60", outStatisticFieldName: "elderly_sum" },
  ]
  const params = new URLSearchParams({
    where: "IS_nivel IS NOT NULL",
    outStatistics: JSON.stringify(outStatistics),
    groupByFieldsForStatistics: "IS_nivel",
    f: "json",
  })
  const res = await fetch(`${POLYGONS_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la población por nivel de amenaza")
  }
  const json = await res.json()
  const features = (json.features ?? []) as Array<{ attributes: Record<string, number | string> }>

  const rows: PopulationByLevel[] = []
  for (const f of features) {
    const level = normalizeSusceptibilityLevel(String(f.attributes.IS_nivel))
    if (!level) continue
    rows.push({
      level,
      total: Number(f.attributes.total_sum) || 0,
      children: Number(f.attributes.children_sum) || 0,
      elderly: Number(f.attributes.elderly_sum) || 0,
    })
  }
  return rows
}

/**
 * Sums critical-infrastructure exposure fields (schools, hospitals,
 * pharmacies, other critical infrastructure) grouped by landslide threat
 * level, via the same server-side statistics approach as
 * `getPopulationByLevel`.
 */
export async function getExposureByLevel(): Promise<ExposureByLevel[]> {
  const outStatistics = [
    { statisticType: "sum", onStatisticField: "n_escuelas", outStatisticFieldName: "schools_sum" },
    { statisticType: "sum", onStatisticField: "n_hospit", outStatisticFieldName: "hospitals_sum" },
    { statisticType: "sum", onStatisticField: "n_farmaci", outStatisticFieldName: "pharmacies_sum" },
    { statisticType: "sum", onStatisticField: "infra_crit", outStatisticFieldName: "critical_infra_sum" },
  ]
  const params = new URLSearchParams({
    where: "IS_nivel IS NOT NULL",
    outStatistics: JSON.stringify(outStatistics),
    groupByFieldsForStatistics: "IS_nivel",
    f: "json",
  })
  const res = await fetch(`${POLYGONS_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la infraestructura expuesta por nivel de amenaza")
  }
  const json = await res.json()
  const features = (json.features ?? []) as Array<{ attributes: Record<string, number | string> }>

  const rows: ExposureByLevel[] = []
  for (const f of features) {
    const level = normalizeSusceptibilityLevel(String(f.attributes.IS_nivel))
    if (!level) continue
    rows.push({
      level,
      schools: Number(f.attributes.schools_sum) || 0,
      hospitals: Number(f.attributes.hospitals_sum) || 0,
      pharmacies: Number(f.attributes.pharmacies_sum) || 0,
      criticalInfra: Number(f.attributes.critical_infra_sum) || 0,
    })
  }
  return rows
}
