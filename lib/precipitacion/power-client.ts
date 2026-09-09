import "server-only"

import { ACCUMULATION_WINDOW_OPTIONS, type AccumulationWindowDays } from "./api-types"

export { ACCUMULATION_WINDOW_OPTIONS }
export type { AccumulationWindowDays }

/**
 * Client for NASA POWER's daily point API (power.larc.nasa.gov), queried
 * once per vereda centroid for `PRECTOTCORR` (bias-corrected precipitation,
 * mm/day). Open, CORS-enabled REST API — no auth needed.
 *
 * Important provenance note: unlike the live IMERG raster on the map (see
 * lib/precipitacion/imerg.ts), POWER's `PRECTOTCORR` is **not** GPM
 * satellite data. NASA POWER blends MERRA-2 for settled dates with
 * GEOS-IT for the last few near-real-time days — both are atmospheric
 * reanalysis/model products at ~0.5° resolution, not direct satellite
 * retrievals (confirmed against the API's own `header.sources` field
 * while building this: `["MERRA2"]` for dates more than ~1-2 weeks old,
 * `["GEOSIT"]` — with `-999` fill values — for the most recent handful of
 * days). This is disclosed in the panel's caption rather than glossed
 * over: it's real, physically-modeled rainfall data and a reasonable
 * proxy, but it is coarser and less direct than IMERG.
 *
 * Coordinates are rounded to 2 decimal places (~1.1 km) before querying —
 * far finer than POWER's own ~0.5° grid, so no accuracy is lost, but it
 * means nearby veredas legitimately share one query (and Next's fetch
 * cache dedupes the identical URL), keeping the fan-out for ~55 veredas
 * well under POWER's grid-cell count for this small study area.
 */

const POWER_DAILY_POINT_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
const FILL_VALUE = -999

// Buffer beyond the requested window, since POWER returns -999 fill values
// for the most recent few days until its near-real-time source settles.
const LOOKBACK_BUFFER_DAYS = 14

const REVALIDATE_SECONDS = 10800 // 3h — rain accumulation changes slowly enough that hourly polling would be wasteful.

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "")
}

export interface PrecipitationAccumulation {
  /** Sum of the most recent `windowDays` valid (non-fill-value) daily totals, in mm. */
  accumulatedMm: number
  /** How many valid days actually went into the sum — normally equal to windowDays. */
  validDays: number
}

/**
 * Fetches accumulated rainfall for one point over the given window (7, 14,
 * or 30 days). Returns `null` if POWER has no valid data at all in the
 * lookback window (never a fabricated value).
 */
export async function getAccumulatedPrecipitation(
  lon: number,
  lat: number,
  windowDays: AccumulationWindowDays = 7,
): Promise<PrecipitationAccumulation | null> {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays + LOOKBACK_BUFFER_DAYS))

  const params = new URLSearchParams({
    parameters: "PRECTOTCORR",
    community: "AG",
    longitude: lon.toFixed(2),
    latitude: lat.toFixed(2),
    start: formatDate(start),
    end: formatDate(end),
    format: "JSON",
  })

  const res = await fetch(`${POWER_DAILY_POINT_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`NASA POWER query failed (${res.status})`)
  }
  const data = await res.json()
  const byDate = data?.properties?.parameter?.PRECTOTCORR as Record<string, number> | undefined
  if (!byDate) return null

  const validValues = Object.keys(byDate)
    .sort() // POWER keys are YYYYMMDD strings, so lexical sort is chronological.
    .map((key) => byDate[key])
    .filter((v) => typeof v === "number" && v !== FILL_VALUE)

  const mostRecentValid = validValues.slice(-windowDays)
  if (mostRecentValid.length === 0) return null

  return {
    accumulatedMm: mostRecentValid.reduce((sum, v) => sum + v, 0),
    validDays: mostRecentValid.length,
  }
}

/**
 * Fetches accumulated rainfall for many points with a concurrency cap, so
 * ~55 vereda centroids don't all fan out to POWER at once. Returns results
 * in the same order as `points`, with `null` for any point POWER had no
 * data for or that failed.
 */
export async function getAccumulatedPrecipitationBatch(
  points: Array<{ lon: number; lat: number }>,
  windowDays: AccumulationWindowDays = 7,
  concurrency = 6,
): Promise<Array<PrecipitationAccumulation | null>> {
  const results: Array<PrecipitationAccumulation | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await getAccumulatedPrecipitation(p.lon, p.lat, windowDays)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}

export interface CurrentYearMonthlyPoint {
  month: number
  /** Sum of valid daily totals so far this month, in mm — null if POWER has no valid days for it. */
  mm: number | null
  validDays: number
  /** True only for the current, still-in-progress month (a partial-month sum, not a full-month total). */
  isPartial: boolean
}

// Only revalidate today's still-accumulating month often; the shorter TTL is fine since this endpoint
// (unlike the amenaza accumulation above) is only hit when a user opens the climatology chart.
const CURRENT_YEAR_REVALIDATE_SECONDS = 3600

/**
 * Fetches this calendar year's daily rainfall (Jan 1 through today) for one
 * point and buckets it into 12 monthly sums, for the "current year" line
 * on the vereda/municipio climatology chart. Months after the current one
 * are `null` (no data yet, not zero) rather than plotted as zero rainfall.
 * The current month's value is a partial-month sum through today, flagged
 * with `isPartial` so the UI can label it as still in progress rather than
 * implying the month is over.
 */
export async function getCurrentYearMonthlyPrecipitation(lon: number, lat: number): Promise<CurrentYearMonthlyPoint[]> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth() + 1

  const params = new URLSearchParams({
    parameters: "PRECTOTCORR",
    community: "AG",
    longitude: lon.toFixed(2),
    latitude: lat.toFixed(2),
    start: `${year}0101`,
    end: formatDate(now),
    format: "JSON",
  })

  const res = await fetch(`${POWER_DAILY_POINT_URL}?${params.toString()}`, {
    next: { revalidate: CURRENT_YEAR_REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`NASA POWER query failed (${res.status})`)
  }
  const data = await res.json()
  const byDate = (data?.properties?.parameter?.PRECTOTCORR ?? {}) as Record<string, number>

  const months: CurrentYearMonthlyPoint[] = []
  for (let month = 1; month <= 12; month++) {
    if (month > currentMonth) {
      months.push({ month, mm: null, validDays: 0, isPartial: false })
      continue
    }
    const prefix = `${year}${String(month).padStart(2, "0")}`
    const validValues = Object.entries(byDate)
      .filter(([key, value]) => key.startsWith(prefix) && typeof value === "number" && value !== FILL_VALUE)
      .map(([, value]) => value)
    months.push({
      month,
      mm: validValues.length > 0 ? Math.round(validValues.reduce((sum, v) => sum + v, 0) * 10) / 10 : null,
      validDays: validValues.length,
      isPartial: month === currentMonth,
    })
  }
  return months
}

/** Batched version of getCurrentYearMonthlyPrecipitation, for averaging across every vereda in a municipio. */
export async function getCurrentYearMonthlyPrecipitationBatch(
  points: Array<{ lon: number; lat: number }>,
  concurrency = 6,
): Promise<Array<CurrentYearMonthlyPoint[] | null>> {
  const results: Array<CurrentYearMonthlyPoint[] | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await getCurrentYearMonthlyPrecipitation(p.lon, p.lat)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
