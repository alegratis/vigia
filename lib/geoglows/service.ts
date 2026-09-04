/**
 * Composition layer: turns a reach id into a full flood assessment by
 * combining the live forecast with return-period thresholds derived from the
 * retrospective record. This is the single entry point used by the API routes.
 */

import {
  getForecast,
  getRetrospectiveDaily,
  getRiverId,
  GeoglowsError,
} from "./client"
import { computeReturnPeriods } from "./gumbel"
import { assessFlood, type FloodAssessment } from "./flood"
import { getStationByReachId, type Station } from "./stations"

export interface ReachAssessment extends FloodAssessment {
  station: Station | null
}

/**
 * Produce a flood assessment for a reach. Forecast and retrospective are
 * fetched in parallel; thresholds are fitted locally via Gumbel.
 */
export async function assessReach(reachId: number): Promise<ReachAssessment> {
  const [forecast, retrospective] = await Promise.all([
    getForecast(reachId),
    getRetrospectiveDaily(reachId),
  ])

  const rp = computeReturnPeriods(retrospective.datetime, retrospective.flow)
  const assessment = assessFlood(reachId, forecast, rp)

  return { ...assessment, station: getStationByReachId(reachId) ?? null }
}

/** Resolve a reach id from coordinates, then assess it. */
export async function assessCoordinate(
  lat: number,
  lon: number,
): Promise<ReachAssessment> {
  const reachId = await getRiverId(lat, lon)
  return assessReach(reachId)
}

export { GeoglowsError }
