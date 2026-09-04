/**
 * Client-safe shapes for the flood API responses. These mirror what the route
 * handlers serialize (see app/api/*). Importing them with `import type` keeps
 * the server-only GEOGLOWS client out of client bundles.
 */

import type { ReachAssessment } from "./service"
import type { FloodLevel, FloodLevelKey } from "./flood"
import type { Station } from "./stations"

/** GET /api/reaches/[reachId] returns the full assessment as JSON. */
export type ReachAssessmentResponse = ReachAssessment

/** One station entry in GET /api/overview. */
export type OverviewStation =
  | {
      station: Station
      ok: true
      generatedAt: string
      units: string
      thresholds: Record<string, number>
      current: { datetime: string; flow: number; level: FloodLevel }
      peak: { datetime: string; flow: number; level: FloodLevel }
      peakUpper: { datetime: string; flow: number; level: FloodLevel }
      medianExceedance: { datetime: string; leadTimeHours: number; level: FloodLevelKey } | null
      upperExceedance: { datetime: string; leadTimeHours: number; level: FloodLevelKey } | null
    }
  | {
      station: Station
      ok: false
      error: string
    }

export interface OverviewResponse {
  department: string
  generatedAt: string
  count: number
  stations: OverviewStation[]
  worst: { slug: string; level: FloodLevelKey } | null
}

export type { FloodLevel, FloodLevelKey, Station }
