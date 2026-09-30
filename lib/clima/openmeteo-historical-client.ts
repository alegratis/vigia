import "server-only"

import { unstable_cache } from "next/cache"

/**
 * Client for Open-Meteo's Historical Weather API (archive-api.open-meteo.com),
 * temperature counterpart to lib/precipitacion/openmeteo-historical-client.ts:
 * instead of a monthly rainfall sum, this averages daily mean temperature
 * (and "feels-like" apparent temperature) across each month — the "current
 * year" and "recent past years" comparison lines on the clima climatology
 * charts (decadal-chart.tsx / quinquenal-chart.tsx).
 *
 * Same archive endpoint as the precipitación client (ECMWF IFS analysis for
 * the most recent ~2 months, ERA5/ERA5-Land reanalysis further back — an
 * assimilated analysis, not a raw station reading, but the same source
 * already trusted for this study area's rainfall numbers).
 *
 * No API key, CORS-enabled, free for non-commercial use.
 */

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

// Same rationale as the precipitación client: recent days can still be revised, keep the TTL modest.
const REVALIDATE_SECONDS = 3600

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface CurrentYearMonthlyTempPoint {
  month: number
  /** Average of daily mean temperature (°C) across this month, or null if Open-Meteo has no data for it yet. */
  tempC: number | null
  /** Average of daily mean apparent ("feels-like") temperature (°C) across this month, or null. */
  sensacionC: number | null
  validDays: number
  /** True only for the current, still-in-progress month (a partial-month average, not a full-month one). */
  isPartial: boolean
}

/**
 * Fetches one calendar year's daily mean/apparent temperature for one point
 * and buckets it into 12 monthly averages — shared by the "current year"
 * line and the "recent past years" comparison lines on the clima
 * climatology charts.
 *
 * Wrapped in `unstable_cache` (keyed by rounded lon/lat/year) for the same
 * reason as the precipitación client: both /api/clima/climatologia-decadal
 * and .../climatologia-quinquenal call this for the exact same points and
 * years, so one shared cache entry keeps both charts reading identical
 * numbers instead of each route re-requesting Open-Meteo independently.
 */
export const getYearMonthlyTemperature = unstable_cache(
  async (lon: number, lat: number, year: number): Promise<CurrentYearMonthlyTempPoint[]> => {
    return fetchYearMonthlyTemperature(lon, lat, year)
  },
  ["year-monthly-temperature"],
  { revalidate: REVALIDATE_SECONDS },
)

async function fetchYearMonthlyTemperature(
  lon: number,
  lat: number,
  year: number,
): Promise<CurrentYearMonthlyTempPoint[]> {
  const now = new Date()
  const isCurrentYear = year === now.getUTCFullYear()
  const currentMonth = now.getUTCMonth() + 1

  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "temperature_2m_mean,apparent_temperature_mean",
    timezone: "America/Bogota",
    start_date: `${year}-01-01`,
    end_date: isCurrentYear ? formatDate(now) : `${year}-12-31`,
  })

  const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`Open-Meteo archive query failed (${res.status})`)
  }
  const data = await res.json()
  const times = (data?.daily?.time ?? []) as string[]
  const means = (data?.daily?.temperature_2m_mean ?? []) as Array<number | null>
  const apparents = (data?.daily?.apparent_temperature_mean ?? []) as Array<number | null>

  const byMonth = new Map<number, { temps: number[]; apparents: number[] }>()
  for (let i = 0; i < times.length; i++) {
    const month = Number(times[i].slice(5, 7))
    if (!byMonth.has(month)) byMonth.set(month, { temps: [], apparents: [] })
    const bucket = byMonth.get(month)!
    if (typeof means[i] === "number") bucket.temps.push(means[i] as number)
    if (typeof apparents[i] === "number") bucket.apparents.push(apparents[i] as number)
  }

  function average(values: number[]): number | null {
    return values.length > 0 ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : null
  }

  const months: CurrentYearMonthlyTempPoint[] = []
  for (let month = 1; month <= 12; month++) {
    if (isCurrentYear && month > currentMonth) {
      months.push({ month, tempC: null, sensacionC: null, validDays: 0, isPartial: false })
      continue
    }
    const bucket = byMonth.get(month) ?? { temps: [], apparents: [] }
    months.push({
      month,
      tempC: average(bucket.temps),
      sensacionC: average(bucket.apparents),
      validDays: bucket.temps.length,
      isPartial: isCurrentYear && month === currentMonth,
    })
  }
  return months
}

/** Batched version of getYearMonthlyTemperature, for averaging across every vereda in a municipio. */
export async function getYearMonthlyTemperatureBatch(
  points: Array<{ lon: number; lat: number }>,
  year: number,
  concurrency = 6,
): Promise<Array<CurrentYearMonthlyTempPoint[] | null>> {
  const results: Array<CurrentYearMonthlyTempPoint[] | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await getYearMonthlyTemperature(p.lon, p.lat, year)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}

/** This calendar year's data, for the chart's "año en curso" line — see getYearMonthlyTemperature. */
export async function getCurrentYearMonthlyTemperature(lon: number, lat: number): Promise<CurrentYearMonthlyTempPoint[]> {
  return getYearMonthlyTemperature(lon, lat, new Date().getUTCFullYear())
}

/** Batched version of getCurrentYearMonthlyTemperature. */
export async function getCurrentYearMonthlyTemperatureBatch(
  points: Array<{ lon: number; lat: number }>,
  concurrency = 6,
): Promise<Array<CurrentYearMonthlyTempPoint[] | null>> {
  return getYearMonthlyTemperatureBatch(points, new Date().getUTCFullYear(), concurrency)
}

/**
 * Averages a batch of per-vereda year-series (see
 * getYearMonthlyTemperatureBatch) into one series, skipping any vereda that
 * failed to resolve — shared by both climatología routes for their "current
 * year" and "recent individual years" lines.
 */
export function averageYearMonthlyTempSeries(
  batch: Array<CurrentYearMonthlyTempPoint[] | null>,
): CurrentYearMonthlyTempPoint[] {
  const valid = batch.filter((series): series is CurrentYearMonthlyTempPoint[] => series != null)
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const temps = valid.map((s) => s[i]?.tempC).filter((v): v is number => v != null)
    const apparents = valid.map((s) => s[i]?.sensacionC).filter((v): v is number => v != null)
    return {
      month,
      tempC: temps.length > 0 ? Math.round((temps.reduce((sum, v) => sum + v, 0) / temps.length) * 10) / 10 : null,
      sensacionC:
        apparents.length > 0 ? Math.round((apparents.reduce((sum, v) => sum + v, 0) / apparents.length) * 10) / 10 : null,
      validDays: Math.max(...valid.map((s) => s[i]?.validDays ?? 0), 0),
      isPartial: valid.some((s) => s[i]?.isPartial),
    }
  })
}

/**
 * The two most recently completed calendar years before the current one
 * (e.g. [2025, 2024] when today is in 2026), for the climatology charts'
 * recent-history comparison lines. Computed relative to today rather than
 * hardcoded so the set rolls forward automatically each January.
 */
export function getRecentPastYears(count = 2, referenceDate: Date = new Date()): number[] {
  const currentYear = referenceDate.getUTCFullYear()
  return Array.from({ length: count }, (_, i) => currentYear - 1 - i)
}
