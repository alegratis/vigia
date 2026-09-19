import "server-only"

/**
 * Self-computed forest-fire hazard model, replacing RED LabOT's
 * `AmenazaIncendios` layer as the sole source for the incendios map's
 * vereda coloring (that layer is no longer surfaced on the incendios map
 * at all — see components/maps/incendios-live-map.tsx; it's still exposed
 * separately for the exposicion map). Unlike
 * the deslizamientos/inundaciones layers this one is replacing,
 * `AmenazaIncendios` has no computational model underneath it to
 * reverse-engineer: it's a static digitization of each municipio's 2014
 * PBOT/PBOT land-use plan fire-hazard zoning, fixed polygons from a
 * nine-year-old planning document, not a hazard index at all. Computed
 * at each vereda's centroid (all ~69 across Sevilla, Caicedonia and
 * Zarzal — `AmenazaIncendios` only ever covered the first two), same
 * architecture as the other two "own model" hazards:
 *
 * - Static factor: slope and road proximity, both reused as-is from the
 *   landslide hazard model's already-computed result at the same
 *   centroid (lib/deslizamientos/hazard-model.ts — no second elevation
 *   or Overpass fetch for the same point) — steeper terrain spreads fire
 *   faster, and most Colombian wildfires are human-caused (agricultural
 *   burns, escaped fires), so road proximity is a real ignition-risk
 *   proxy. Combined with historical fire recurrence (fire-history.ts) —
 *   NASA FIRMS hotspot density near the centroid over a multi-month
 *   lookback — which gets the largest static weight: it's direct
 *   ground-truth evidence of where fire has actually burned before, not
 *   an indirect proxy like the other two, the same role the SGC mass-
 *   movement inventory plays in the landslide model.
 * - Dynamic factor: today's Fire Weather Index (fire-weather.ts) — the
 *   Canadian FWI System's standard equations, computed from Open-Meteo
 *   historical weather rather than read from GWIS' own (tile-only,
 *   non-queryable) FWI layer.
 *
 * Combined with the same "renormalize over whatever factors actually
 * resolved, `null` only if everything failed" pattern used throughout
 * this app. Scored onto the same 4-level `FIRE_THREAT_LEVELS` vocabulary
 * `AmenazaIncendios` already used (and this app's own CSS color tokens
 * already have) — no new levels or colors introduced.
 *
 * This is this app's own model, not a published index — the numbers are
 * defensible and documented, but shouldn't be read as an official
 * hazard rating the way `AmenazaIncendios` was.
 */

import { fireHistoryScore, getHistoricalFireDetections } from "./fire-history"
import { computeFireWeatherBatch } from "./fire-weather"
import { FIRE_THREAT_LEVELS, type FireThreatLevel } from "./levels"

/** How much road proximity vs. historical fire recurrence contributes to the static factor (slope's weight is implicit: 1 − ROAD − HISTORY). */
const SLOPE_WEIGHT = 0.25
const ROAD_WEIGHT = 0.15
const HISTORY_WEIGHT = 0.6
/** How much the static factor vs. today's Fire Weather Index contributes to the final score. */
const STATIC_WEIGHT = 0.6
const WEATHER_WEIGHT = 0.4

/** Slope at/above this (degrees) maxes out the slope factor's contribution — same cap as the landslide model. */
const MAX_SLOPE_DEG = 45
/** Roads farther than this (km) stop contributing to the road-proximity factor at all — same influence radius as the landslide model. */
const ROAD_INFLUENCE_KM = 1

/** Score cutoffs mapping the final 0–1 composite onto AmenazaIncendios' own 4-level vocabulary (no "Muy alto" tier — see levels.ts). */
function levelFromScore(score: number): FireThreatLevel {
  if (score < 0.25) return "Muy bajo"
  if (score < 0.5) return "Bajo"
  if (score < 0.75) return "Medio"
  return "Alto"
}

export interface FireHazardCentroid {
  codigoVereda: string
  lat: number
  lon: number
  /** Slope (degrees) at this centroid, reused from the landslide model's already-computed value — never re-fetched here. */
  slopeDeg: number | null
  /** Distance (km) to the nearest OSM road, reused the same way. */
  roadDistanceKm: number | null
}

export interface VeredaFireHazardResult {
  level: FireThreatLevel | null
  /** Final 0–1 composite score, or `null` if every input factor failed for this vereda. */
  score: number | null
  slopeDeg: number | null
  roadDistanceKm: number | null
  /** Historical VIIRS detections within the recurrence factor's radius — see fire-history.ts. */
  historyCount: number | null
  /** Today's Fire Weather Index at this centroid — see fire-weather.ts. */
  fwi: number | null
}

/**
 * Computes the fire hazard level for every input centroid. Historical
 * detections are fetched once for the whole batch (a single AOI-wide,
 * multi-chunk FIRMS query); fire weather is computed once per centroid
 * (each needs its own weather spin-up). Slope and road distance are
 * taken from the caller, not fetched here.
 *
 * Combines only the factors that actually resolved for a given point —
 * re-normalizing the weights over just those — so one factor's
 * transient failure lowers precision instead of dragging every vereda's
 * score down. A vereda with no usable factors at all gets `null`
 * everywhere, never a fabricated score.
 */
export async function computeVeredaFireHazard(
  centroids: FireHazardCentroid[],
): Promise<Map<string, VeredaFireHazardResult>> {
  const result = new Map<string, VeredaFireHazardResult>()
  if (centroids.length === 0) return result

  const [historyPoints, fireWeather] = await Promise.all([
    getHistoricalFireDetections().catch(() => []),
    computeFireWeatherBatch(centroids).catch(() => null),
  ])

  centroids.forEach((c, i) => {
    const slopeDeg = c.slopeDeg
    const roadDistanceKm = c.roadDistanceKm
    const history = historyPoints.length > 0 ? fireHistoryScore(c.lat, c.lon, historyPoints) : null
    const weather = fireWeather?.[i] ?? null

    const slopeScore = slopeDeg != null ? Math.min(1, slopeDeg / MAX_SLOPE_DEG) : null
    const roadScore = roadDistanceKm != null ? Math.max(0, 1 - roadDistanceKm / ROAD_INFLUENCE_KM) : null
    const historyScoreVal = history?.score ?? null

    const staticWeight =
      (slopeScore != null ? SLOPE_WEIGHT : 0) +
      (roadScore != null ? ROAD_WEIGHT : 0) +
      (historyScoreVal != null ? HISTORY_WEIGHT : 0)
    const staticScore =
      staticWeight > 0
        ? ((slopeScore ?? 0) * (slopeScore != null ? SLOPE_WEIGHT : 0) +
            (roadScore ?? 0) * (roadScore != null ? ROAD_WEIGHT : 0) +
            (historyScoreVal ?? 0) * (historyScoreVal != null ? HISTORY_WEIGHT : 0)) /
          staticWeight
        : null

    const weatherScore = weather?.score ?? null

    const totalWeight = (staticScore != null ? STATIC_WEIGHT : 0) + (weatherScore != null ? WEATHER_WEIGHT : 0)
    const finalScore =
      totalWeight > 0
        ? ((staticScore ?? 0) * (staticScore != null ? STATIC_WEIGHT : 0) +
            (weatherScore ?? 0) * (weatherScore != null ? WEATHER_WEIGHT : 0)) /
          totalWeight
        : null

    result.set(c.codigoVereda, {
      level: finalScore != null ? levelFromScore(finalScore) : null,
      score: finalScore,
      slopeDeg,
      roadDistanceKm,
      historyCount: history?.count ?? null,
      fwi: weather?.fwi ?? null,
    })
  })

  return result
}

/** Re-exported so callers don't need to reach into levels.ts separately just for this. */
export { FIRE_THREAT_LEVELS }
