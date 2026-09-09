import "server-only"

/**
 * Self-computed landslide hazard model, replacing RED LabOT's
 * `VIGIA_Amenaza_IS_Puntos`/`IS_Poligonos` index as the source for the
 * deslizamientos map's coloring (the population/school/hospital exposure
 * panel keeps reading RED LabOT directly — see lib/deslizamientos/client.ts
 * — since there's no other per-vereda population source). Computed at each
 * vereda's centroid (~55 points across Sevilla, Caicedonia *and* Zarzal,
 * which the RED LabOT layer never covered) rather than a dense point grid,
 * since each point here costs an elevation-gradient sample and a rainfall
 * history lookup.
 *
 * Loosely follows NASA's LHASA v1 (Stanley & Kirschbaum, 2017) structure —
 * a static terrain-susceptibility factor combined with a dynamic rainfall
 * "nowcast" trigger — using open, no-auth data sources that are actually
 * queryable by point from a serverless function:
 *
 * - Static factor: slope (lib/deslizamientos/elevation.ts, from Copernicus
 *   DEM via Open-Meteo) + distance to nearest road (road-proximity.ts, from
 *   OSM Overpass) + distance to the nearest mapped geological fault
 *   (faults.ts, from the Colombian Geological Survey — SGC — Atlas
 *   Geológico's fault-trace layer) + distance to the nearest documented
 *   historical mass movement (landslide-inventory.ts, from the SGC's
 *   national mass-movement inventory — SIMMA-derived). This last factor
 *   gets the largest static-factor weight: it's direct ground-truth
 *   evidence of past instability, not an indirect geomorphological proxy
 *   like the other three — though with only ~55 sparse, undated points
 *   across the whole AOI it's a supplement to the other factors, not a
 *   replacement. ESA WorldCover (land cover) — LHASA's remaining static
 *   predictor — was considered but dropped: it's only published as a raw
 *   satellite raster file (COG/GeoTIFF) with no free point-query API, so
 *   fetching it per-point from a route handler isn't practical. Geology/
 *   faults and the historical inventory *were* dropped for the same
 *   reason until each turned out to be the exception — small, directly
 *   queryable vector layers, not rasters.
 * - Dynamic factor: decayed antecedent rainfall vs. its own 3-year
 *   same-season baseline (rainfall-trigger.ts, from Open-Meteo's archive
 *   API) — LHASA's percentile-exceedance trigger, simplified to a ratio
 *   threshold.
 *
 * This is this app's own model, not a published index — the numbers are
 * defensible and documented, but shouldn't be read as an official
 * susceptibility rating the way the RED LabOT layer was.
 */

import { getSlopeForCentroids } from "./elevation"
import { getRoadVertices, nearestRoadDistanceKm } from "./road-proximity"
import { getFaultTraces, nearestFaultDistanceKm } from "./faults"
import { getLandslideRecords, nearestLandslideDistanceKm } from "./landslide-inventory"
import { computeRainfallTriggerBatch } from "./rainfall-trigger"
import { SUSCEPTIBILITY_LEVELS, type SusceptibilityLevel } from "./levels"

/** How much slope vs. road proximity vs. fault proximity vs. historical-inventory proximity contributes to the static factor. */
const SLOPE_WEIGHT = 0.35
const ROAD_WEIGHT = 0.15
const FAULT_WEIGHT = 0.2
const HISTORY_WEIGHT = 0.3
/** How much the static factor vs. the rainfall trigger contributes to the final score. */
const STATIC_WEIGHT = 0.6
const TRIGGER_WEIGHT = 0.4

/** Slope at/above this (degrees) maxes out the slope factor's contribution. */
const MAX_SLOPE_DEG = 45
/** Roads farther than this (km) stop contributing to the road-proximity factor at all. */
const ROAD_INFLUENCE_KM = 1
/** Faults farther than this (km) stop contributing to the fault-proximity factor at all. */
const FAULT_INFLUENCE_KM = 2
/** Historical mass movements farther than this (km) stop contributing to that factor at all. */
const HISTORY_INFLUENCE_KM = 2

/** Score cutoffs mapping the final 0–1 composite onto the app's shared 5-level scheme. */
function levelFromScore(score: number): SusceptibilityLevel {
  if (score < 0.2) return "Muy bajo"
  if (score < 0.4) return "Bajo"
  if (score < 0.6) return "Medio"
  if (score < 0.8) return "Alto"
  return "Muy alto"
}

export interface HazardCentroid {
  codigoVereda: string
  lat: number
  lon: number
}

export interface VeredaHazardResult {
  level: SusceptibilityLevel | null
  /** Final 0–1 composite score, or `null` if every input factor failed for this vereda. */
  score: number | null
  slopeDeg: number | null
  roadDistanceKm: number | null
  /** Distance (km) from this centroid to the nearest mapped geological fault (SGC). */
  faultDistanceKm: number | null
  /** Distance (km) from this centroid to the nearest documented historical mass movement (SGC inventory). */
  historyDistanceKm: number | null
  /** Current antecedent-rainfall index over its 3-year same-season baseline; `null` if no baseline could be formed. */
  rainfallRatio: number | null
}

/**
 * Computes the hazard level for every input centroid. Each of the three
 * factors is fetched once for the whole batch (elevation and rainfall are
 * already-batched requests; roads are a single AOI-wide query), then
 * combined per point.
 *
 * Combines only the factors that actually resolved for a given point —
 * re-normalizing the weights over just those — so one factor's transient
 * failure lowers precision instead of silently dragging every vereda's
 * score down. A vereda with no usable factors at all gets `null`
 * everywhere (same "no data" convention the RED LabOT integration already
 * used for Zarzal), never a fabricated score.
 */
export async function computeVeredaHazard(
  centroids: HazardCentroid[],
): Promise<Map<string, VeredaHazardResult>> {
  const result = new Map<string, VeredaHazardResult>()
  if (centroids.length === 0) return result

  const [slopes, roadVertices, faultTraces, landslideRecords, rainfallTriggers] = await Promise.all([
    getSlopeForCentroids(centroids).catch(() => null),
    getRoadVertices().catch(() => null),
    getFaultTraces().catch(() => null),
    getLandslideRecords().catch(() => null),
    computeRainfallTriggerBatch(centroids, 12).catch(() => null),
  ])

  centroids.forEach((c, i) => {
    const slopeDeg = slopes?.[i] ?? null
    const roadDistanceKm = roadVertices ? nearestRoadDistanceKm(c.lat, c.lon, roadVertices) : null
    const faultDistanceKm = faultTraces ? nearestFaultDistanceKm(c.lat, c.lon, faultTraces) : null
    const historyDistanceKm = landslideRecords
      ? nearestLandslideDistanceKm(c.lat, c.lon, landslideRecords)
      : null
    const trigger = rainfallTriggers?.[i] ?? null

    const slopeScore = slopeDeg != null ? Math.min(1, slopeDeg / MAX_SLOPE_DEG) : null
    const roadScore = roadDistanceKm != null ? Math.max(0, 1 - roadDistanceKm / ROAD_INFLUENCE_KM) : null
    const faultScore = faultDistanceKm != null ? Math.max(0, 1 - faultDistanceKm / FAULT_INFLUENCE_KM) : null
    const historyScore =
      historyDistanceKm != null ? Math.max(0, 1 - historyDistanceKm / HISTORY_INFLUENCE_KM) : null

    const staticWeight =
      (slopeScore != null ? SLOPE_WEIGHT : 0) +
      (roadScore != null ? ROAD_WEIGHT : 0) +
      (faultScore != null ? FAULT_WEIGHT : 0) +
      (historyScore != null ? HISTORY_WEIGHT : 0)
    const staticScore =
      staticWeight > 0
        ? ((slopeScore ?? 0) * (slopeScore != null ? SLOPE_WEIGHT : 0) +
            (roadScore ?? 0) * (roadScore != null ? ROAD_WEIGHT : 0) +
            (faultScore ?? 0) * (faultScore != null ? FAULT_WEIGHT : 0) +
            (historyScore ?? 0) * (historyScore != null ? HISTORY_WEIGHT : 0)) /
          staticWeight
        : null

    const triggerScore = trigger?.score ?? null

    const totalWeight = (staticScore != null ? STATIC_WEIGHT : 0) + (triggerScore != null ? TRIGGER_WEIGHT : 0)
    const finalScore =
      totalWeight > 0
        ? ((staticScore ?? 0) * (staticScore != null ? STATIC_WEIGHT : 0) +
            (triggerScore ?? 0) * (triggerScore != null ? TRIGGER_WEIGHT : 0)) /
          totalWeight
        : null

    result.set(c.codigoVereda, {
      level: finalScore != null ? levelFromScore(finalScore) : null,
      score: finalScore,
      slopeDeg,
      roadDistanceKm,
      faultDistanceKm,
      historyDistanceKm,
      rainfallRatio: trigger?.ratio ?? null,
    })
  })

  return result
}

/** Re-exported so callers don't need to reach into levels.ts separately just for this. */
export { SUSCEPTIBILITY_LEVELS }
