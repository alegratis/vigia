import type { FireDetection, FireResult } from "./client"
import type { FireSummary } from "./summary"

export type { FireDetection }

export type FiresResponse = {
  area: { west: number; south: number; east: number; north: number }
  department: string
  dayRange: number
  detections: FireDetection[]
  summary: FireSummary
  sourcesQueried: FireResult["sourcesQueried"]
  sourcesFailed: FireResult["sourcesFailed"]
  generatedAt: string
}

export type FiresErrorResponse = {
  error: string
  /** True when the cause is a missing/invalid FIRMS_MAP_KEY, so the UI can prompt for setup. */
  needsConfig?: boolean
}
