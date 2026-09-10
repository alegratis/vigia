import "server-only"

/**
 * Self-computed flood-susceptibility model — this app's own extension of
 * the official, static `susceptibilidad_inundaciones` zoning layer (see
 * lib/inundaciones/client.ts), which only covers Sevilla and Caicedonia's
 * zoned area and carries no vereda attribute at all. Computed once per
 * vereda centroid (same architecture as the landslide hazard model, see
 * lib/deslizamientos/hazard-model.ts), so it reaches all three
 * municipios — including Zarzal — and plugs straight into the shared
 * /api/veredas pipeline for vereda-level granularity, a map layer, and an
 * in-app methodology panel, the same way the landslide model does.
 *
 * The official zoning layer isn't replaced — it's kept as this model's
 * highest-weight input, since it's the one direct piece of official
 * evidence available (where it has coverage at all):
 *
 * - Official zoning class (50%) — point-in-polygon against the
 *   dissolved `susceptibilidad_inundaciones` polygons (lib/inundaciones/
 *   client.ts), mapped onto a 0–1 score by FLOOD_SUSCEPTIBILITY_LEVELS
 *   order. Only resolves inside Sevilla/Caicedonia's zoned extent.
 * - Stream proximity (30%) — true point-to-segment distance (lib/
 *   inundaciones/streams.ts) to the nearest named stream/creek trace —
 *   the primary geomorphological driver of flood extent, and the only
 *   input here that actually reaches Zarzal.
 * - Terrain flatness (20%) — reuses the slope already computed for the
 *   landslide model at the same centroid (lib/deslizamientos/
 *   elevation.ts, passed in rather than re-fetched), but inverted: flat
 *   land near a stream floods more readily, steep land drains and sheds
 *   water instead of ponding it.
 *
 * No dynamic trigger factor (unlike the landslide model's rainfall
 * anomaly): flood susceptibility zoning is inherently static, and this
 * app's live river forecast (GEOGLOWS, already on the inundaciones map)
 * is kept as a separate, dynamic layer rather than folded into this
 * static per-vereda score — same separation of concerns the app already
 * has between the landslide model's static factor and its rainfall
 * trigger.
 *
 * This is this app's own model, not a published index — the numbers are
 * defensible and documented, but shouldn't be read as an official
 * susceptibility rating the way the zoning layer's own class is. Zoning
 * still gets the largest single weight because it's direct official
 * evidence, but it's capped at 50% (rather than, say, 80%) specifically
 * so a vereda with zero zoning coverage — every vereda in Zarzal — still
 * gets a meaningful, non-degenerate score from the other two factors
 * instead of falling back to nothing.
 */

import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon"
import { getFloodSusceptibilityPolygons } from "./client"
import { getStreamTraces, nearestStreamDistanceKm } from "./streams"
import { FLOOD_SUSCEPTIBILITY_LEVELS, isFloodSusceptibilityLevel, type FloodSusceptibilityLevel } from "./levels"

/** How much the official zoning class vs. stream proximity vs. terrain flatness contributes to the final score. */
const ZONING_WEIGHT = 0.5
const STREAM_WEIGHT = 0.3
const FLATNESS_WEIGHT = 0.2

/** Streams farther than this (km) stop contributing to the stream-proximity factor at all. */
const STREAM_INFLUENCE_KM = 1
/** Slope at/above this (degrees) zeroes out the flatness factor's contribution — steep land doesn't pond water. */
const MAX_FLATNESS_SLOPE_DEG = 8

/** Score cutoffs mapping the final 0–1 composite onto the zoning layer's own 5-level vocabulary. */
function levelFromScore(score: number): FloodSusceptibilityLevel {
  if (score < 0.2) return "Muy baja"
  if (score < 0.4) return "Baja"
  if (score < 0.6) return "Moderada"
  if (score < 0.8) return "Alta"
  return "Muy alta"
}

/** Maps a zoning class onto the same 0–1 scale the composite score uses (Muy alta=1 … Muy baja=0). */
function zoningLevelToScore(level: FloodSusceptibilityLevel): number {
  const index = FLOOD_SUSCEPTIBILITY_LEVELS.indexOf(level)
  return 1 - index / (FLOOD_SUSCEPTIBILITY_LEVELS.length - 1)
}

function isPolygonal(
  geometry: GeoJSON.Geometry,
): geometry is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon"
}

export interface FloodHazardCentroid {
  codigoVereda: string
  lat: number
  lon: number
  /** Slope (degrees) at this centroid, reused from the landslide model's already-computed value — never re-fetched here. */
  slopeDeg: number | null
}

export interface VeredaFloodHazardResult {
  level: FloodSusceptibilityLevel | null
  /** Final 0–1 composite score, or `null` if every input factor failed/didn't resolve for this vereda. */
  score: number | null
  streamDistanceKm: number | null
  slopeDeg: number | null
  /** Official zoning class at this centroid, if it falls inside a zoned polygon. */
  zoningLevel: FloodSusceptibilityLevel | null
  /** Whether this centroid falls inside the official zoning layer's coverage at all — `false` for every Zarzal vereda. */
  zoningCovered: boolean
}

/**
 * Computes the flood hazard level for every input centroid. Fetches the
 * zoning polygons and stream traces once for the whole batch, then
 * combines the three factors per point.
 *
 * Combines only the factors that resolved for a given point —
 * re-normalizing the weights over just those — so a vereda outside the
 * zoning layer's coverage (every vereda in Zarzal) still gets a
 * meaningful score from streams + flatness instead of `null`, and a
 * vereda where the stream layer failed to load doesn't silently zero out
 * either. A vereda with no usable factors at all gets `null` everywhere,
 * never a fabricated score.
 */
export async function computeVeredaFloodHazard(
  centroids: FloodHazardCentroid[],
): Promise<Map<string, VeredaFloodHazardResult>> {
  const result = new Map<string, VeredaFloodHazardResult>()
  if (centroids.length === 0) return result

  const [zoningPolygons, streamTraces] = await Promise.all([
    getFloodSusceptibilityPolygons().catch(() => null),
    getStreamTraces().catch(() => null),
  ])

  const zonedFeatures = (zoningPolygons?.features ?? []).filter((f) => isPolygonal(f.geometry))

  centroids.forEach((c) => {
    let zoningLevel: FloodSusceptibilityLevel | null = null
    for (const feature of zonedFeatures) {
      if (booleanPointInPolygon([c.lon, c.lat], feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon)) {
        const descripcio = feature.properties.descripcio
        if (isFloodSusceptibilityLevel(descripcio)) zoningLevel = descripcio
        break
      }
    }
    const zoningCovered = zoningLevel != null
    const zoningScore = zoningLevel != null ? zoningLevelToScore(zoningLevel) : null

    const streamDistanceKm = streamTraces ? nearestStreamDistanceKm(c.lat, c.lon, streamTraces) : null
    const streamScore =
      streamDistanceKm != null ? Math.max(0, 1 - streamDistanceKm / STREAM_INFLUENCE_KM) : null

    const slopeDeg = c.slopeDeg
    const flatnessScore = slopeDeg != null ? 1 - Math.min(1, slopeDeg / MAX_FLATNESS_SLOPE_DEG) : null

    const totalWeight =
      (zoningScore != null ? ZONING_WEIGHT : 0) +
      (streamScore != null ? STREAM_WEIGHT : 0) +
      (flatnessScore != null ? FLATNESS_WEIGHT : 0)
    const finalScore =
      totalWeight > 0
        ? ((zoningScore ?? 0) * (zoningScore != null ? ZONING_WEIGHT : 0) +
            (streamScore ?? 0) * (streamScore != null ? STREAM_WEIGHT : 0) +
            (flatnessScore ?? 0) * (flatnessScore != null ? FLATNESS_WEIGHT : 0)) /
          totalWeight
        : null

    result.set(c.codigoVereda, {
      level: finalScore != null ? levelFromScore(finalScore) : null,
      score: finalScore,
      streamDistanceKm,
      slopeDeg,
      zoningLevel,
      zoningCovered,
    })
  })

  return result
}
