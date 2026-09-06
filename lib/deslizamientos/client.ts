import "server-only"

/**
 * Client for the public landslide-susceptibility layer published on ArcGIS
 * Online (`amenaza_por_deslizamiento`, covering Sevilla and Caicedonia — the
 * study area's hillside municipalities; Zarzal sits on the flat valley floor
 * and has no zones in the source layer) and the companion population-density
 * grid used to estimate exposure by threat level. Both are open,
 * CORS-enabled FeatureServer layers — no auth needed, same publishing
 * pattern GEOGLOWS uses for the flood layer (lib/geoglows/live-map.ts).
 *
 * Docs: https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/amenaza_por_deslizamiento/FeatureServer
 */

import type {
  PopulationByLevel,
  SusceptibilityFeatureCollection,
} from "./api-types"
import { isSusceptibilityLevel, SUSCEPTIBILITY_LEVELS, type SusceptibilityLevel } from "./levels"

const SERVICE_ROOT = "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services"
const SUSCEPTIBILITY_LAYER = `${SERVICE_ROOT}/amenaza_por_deslizamiento/FeatureServer/0`
const POPULATION_LAYER = `${SERVICE_ROOT}/DensityMaps_In/FeatureServer/0`

/** Fetches the 10 landslide susceptibility polygons as ready-to-render GeoJSON in WGS84. */
export async function getSusceptibilityPolygons(): Promise<SusceptibilityFeatureCollection> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "municipio,IS_nivel",
    outSR: "4326",
    geometryPrecision: "5",
    f: "geojson",
  })
  const res = await fetch(`${SUSCEPTIBILITY_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la capa de susceptibilidad a deslizamientos")
  }
  return res.json()
}

/**
 * Fetches the worst (highest) susceptibility level present per municipality,
 * for the demografía exposure summary. This reuses the same layer as
 * `getSusceptibilityPolygons` but skips geometry and asks the server to
 * distinct the municipio/IS_nivel pairs instead of downloading all 10
 * polygons — the same "let the server aggregate" approach as
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
  const res = await fetch(`${SUSCEPTIBILITY_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la capa de susceptibilidad a deslizamientos")
  }
  const json = await res.json()
  const features = (json.features ?? []) as Array<{
    attributes: { municipio?: string; IS_nivel?: string }
  }>

  const worstByMunicipio = new Map<string, SusceptibilityLevel>()
  for (const f of features) {
    const rawMunicipio = f.attributes.municipio
    const level = f.attributes.IS_nivel
    if (!rawMunicipio || !level || !isSusceptibilityLevel(level)) continue
    // The layer stores municipio names upper-cased (e.g. "SEVILLA"); the
    // DANE population data this gets cross-referenced against uses title
    // case ("Sevilla"), so normalize here rather than in every caller.
    const municipio =
      rawMunicipio.charAt(0) + rawMunicipio.slice(1).toLowerCase()
    const current = worstByMunicipio.get(municipio)
    if (!current || SUSCEPTIBILITY_LEVELS.indexOf(level) > SUSCEPTIBILITY_LEVELS.indexOf(current)) {
      worstByMunicipio.set(municipio, level)
    }
  }
  return worstByMunicipio
}

/**
 * Sums the population-density grid grouped by landslide threat level via a
 * server-side statistics query, avoiding a client download of all ~8,800
 * grid points.
 *
 * The grid also carries `col_men_20`/`col_women_` fields, but those are
 * always exactly half of the total in every group — a synthetic 50/50
 * split, not real sex-disaggregated data. This intentionally omits that
 * split and only surfaces totals and age brackets that are traceable to a
 * real reading, consistent with lib/demografia/exposure.ts.
 */
export async function getPopulationByLevel(): Promise<PopulationByLevel[]> {
  const outStatistics = [
    { statisticType: "sum", onStatisticField: "col_genera", outStatisticFieldName: "total_sum" },
    { statisticType: "sum", onStatisticField: "col_childr", outStatisticFieldName: "children_sum" },
    { statisticType: "sum", onStatisticField: "col_elderl", outStatisticFieldName: "elderly_sum" },
  ]
  const params = new URLSearchParams({
    where: "IS_nivel IS NOT NULL",
    outStatistics: JSON.stringify(outStatistics),
    groupByFieldsForStatistics: "IS_nivel",
    f: "json",
  })
  const res = await fetch(`${POPULATION_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la población por nivel de amenaza")
  }
  const json = await res.json()
  const features = (json.features ?? []) as Array<{ attributes: Record<string, number | string> }>

  return features
    .map((f) => ({
      level: String(f.attributes.IS_nivel),
      total: Number(f.attributes.total_sum) || 0,
      children: Number(f.attributes.children_sum) || 0,
      elderly: Number(f.attributes.elderly_sum) || 0,
    }))
    .filter((r) => isSusceptibilityLevel(r.level))
}
