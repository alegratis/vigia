import "server-only"

/**
 * Per-vereda seismic exposure score, the fifth input into
 * lib/riesgo-compuesto/compound-model.ts. Unlike the other four hazards,
 * sismología has no per-vereda susceptibility zonation published anywhere
 * (SGC and USGS publish event catalogs, not a zoned hazard map for this
 * scale) — so instead of a zoning join like `incendios-join.ts`, this
 * computes a distance-decay exposure score directly from nearby epicenters,
 * combining both sources:
 *
 * - Each event's contribution is weighted by its energy (magnitude, via the
 *   standard log-linear proxy `10^(0.5*mag)` — the same relative scaling
 *   used to compare quake energy release, not an invented curve) and decays
 *   with distance via an inverse-square falloff (`1 / (1 + (d/radius)^2)`),
 *   the same "distance-decay" shape requested rather than a hard cutoff.
 * - SGC's historical events are additionally recency-weighted
 *   (`exp(-ageYears / halfLifeYears)`) so a centuries-old event contributes
 *   less than a recent one — "recency-weighted so old events contribute
 *   less," per the brief. USGS's live events are all within the last
 *   `USGS_WINDOW_DAYS` days, so they get no additional decay.
 * - The summed influence per vereda is compressed into 0–1 via
 *   `1 - exp(-sum / scale)`, the same bounded-saturating shape already used
 *   throughout this app to turn an unbounded raw quantity into a 0–1 score
 *   (e.g. `zoningLevelToScore`-style conventions elsewhere in this app).
 */

import { distance } from "@turf/distance"
import { point } from "@turf/helpers"
import { getSismologiaEventos } from "./server"
import type { SeismicEvent } from "./api-types"

/** Distance-decay radius (km): influence roughly halves by this distance. */
const DECAY_RADIUS_KM = 60
/** Recency half-life (years) for SGC historical events. */
const RECENCY_HALF_LIFE_YEARS = 40
/**
 * Compression scale — tuned against a handful of reference scenarios,
 * including the combined influence of a full cluster of events (not just
 * the single strongest one), so the 0–1 output spreads across the scale
 * instead of any one strong regional event saturating every vereda to the
 * same tier: a distant M4 alone lands very low (~0.02), a M5 at 50 km
 * lands low (~0.1), a M6 within 30 km lands low-moderate (~0.4), a
 * regional M7+ around 80 km away (summed with the rest of an active
 * cluster) lands in the upper range (~0.75, "Alto") and only a direct-hit
 * M7+ within ~10 km saturates to "Muy alto" (~0.85+) — a nearby major
 * event should read as severe, but shouldn't flatten every vereda in the
 * AOI to the same maximum tier the way a too-small scale does.
 */
const SCORE_SCALE = 1700

function energyWeight(magnitude: number): number {
  return Math.pow(10, 0.5 * magnitude)
}

function recencyWeight(event: SeismicEvent): number {
  if (event.source === "usgs") return 1 // already restricted to a recent live window
  const ageYears = (Date.now() - new Date(event.time).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (!Number.isFinite(ageYears) || ageYears < 0) return 1
  return Math.exp(-ageYears / RECENCY_HALF_LIFE_YEARS)
}

function eventInfluence(event: SeismicEvent, distanceKm: number): number {
  const decay = 1 / (1 + (distanceKm / DECAY_RADIUS_KM) ** 2)
  return energyWeight(event.magnitude) * recencyWeight(event) * decay
}

export interface SeismicCentroid {
  codigoVereda: string
  lat: number
  lon: number
}

export interface SeismicExposureResult {
  score: number
  /** Distance to the nearest contributing event, for the report's "detail" line. */
  nearestEventKm: number | null
  nearestEventMagnitude: number | null
}

/**
 * Computes the 0–1 seismic exposure score at each vereda centroid from the
 * combined USGS + SGC event set. Returns a Map keyed by `codigoVereda`;
 * every vereda gets a score (never `null`) since seismic exposure is a
 * regional, not zoned, phenomenon — a vereda far from every known event
 * simply scores close to 0.
 */
export async function getSeismicExposureByVereda(
  centroids: SeismicCentroid[],
): Promise<Map<string, SeismicExposureResult>> {
  const result = new Map<string, SeismicExposureResult>()
  if (centroids.length === 0) return result

  const eventos = await getSismologiaEventos()
  const events = [...eventos.usgs.events, ...eventos.sgc.events]

  for (const c of centroids) {
    const origin = point([c.lon, c.lat])
    let sum = 0
    let nearestKm: number | null = null
    let nearestMag: number | null = null

    for (const event of events) {
      const d = distance(origin, point([event.lon, event.lat]), { units: "kilometers" })
      if (nearestKm == null || d < nearestKm) {
        nearestKm = d
        nearestMag = event.magnitude
      }
      sum += eventInfluence(event, d)
    }

    result.set(c.codigoVereda, {
      score: 1 - Math.exp(-sum / SCORE_SCALE),
      nearestEventKm: nearestKm,
      nearestEventMagnitude: nearestMag,
    })
  }

  return result
}
