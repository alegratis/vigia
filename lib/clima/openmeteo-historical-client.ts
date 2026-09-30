import "server-only"

import { unstable_cache } from "next/cache"

/**
 * Client for Open-Meteo's Historical Weather API (archive-api.open-meteo.com),
 * temperature counterpart to lib/precipitacion/openmeteo-historical-client.ts:
 * instead of a monthly rainfall sum, this averages each day's maximum, mean,
 * and minimum temperature (plus "feels-like" apparent maximum) across each
 * month, for the "current year" (all three, plotted as separate lines) and
 * "recent past years" comparison lines (mean only, to keep those lines
 * simple) on the clima climatology charts (decadal-chart.tsx /
 * quinquenal-chart.tsx).
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
  tempMeanC: number | null
  /** Average of daily maximum temperature (°C) across this month, or null. */
  tempMaxC: number | null
  /** Average of daily minimum temperature (°C) across this month, or null. */
  tempMinC: number | null
  /** Average of daily maximum apparent ("feels-like") temperature (°C) across this month, or null. */
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
    daily: "temperature_2m_max,temperature_2m_mean,temperature_2m_min,apparent_temperature_max",
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
  const maxes = (data?.daily?.temperature_2m_max ?? []) as Array<number | null>
  const means = (data?.daily?.temperature_2m_mean ?? []) as Array<number | null>
  const mins = (data?.daily?.temperature_2m_min ?? []) as Array<number | null>
  const apparents = (data?.daily?.apparent_temperature_max ?? []) as Array<number | null>

  const byMonth = new Map<number, { maxes: number[]; means: number[]; mins: number[]; apparents: number[] }>()
  for (let i = 0; i < times.length; i++) {
    const month = Number(times[i].slice(5, 7))
    if (!byMonth.has(month)) byMonth.set(month, { maxes: [], means: [], mins: [], apparents: [] })
    const bucket = byMonth.get(month)!
    if (typeof maxes[i] === "number") bucket.maxes.push(maxes[i] as number)
    if (typeof means[i] === "number") bucket.means.push(means[i] as number)
    if (typeof mins[i] === "number") bucket.mins.push(mins[i] as number)
    if (typeof apparents[i] === "number") bucket.apparents.push(apparents[i] as number)
  }

  function average(values: number[]): number | null {
    return values.length > 0 ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : null
  }

  const months: CurrentYearMonthlyTempPoint[] = []
  for (let month = 1; month <= 12; month++) {
    if (isCurrentYear && month > currentMonth) {
      months.push({
        month,
        tempMeanC: null,
        tempMaxC: null,
        tempMinC: null,
        sensacionC: null,
        validDays: 0,
        isPartial: false,
      })
      continue
    }
    const bucket = byMonth.get(month) ?? { maxes: [], means: [], mins: [], apparents: [] }
    months.push({
      month,
      tempMeanC: average(bucket.means),
      tempMaxC: average(bucket.maxes),
      tempMinC: average(bucket.mins),
      sensacionC: average(bucket.apparents),
      validDays: bucket.means.length,
      isPartial: isCurrentYear && month === currentMonth,
    })
  }
  return months
}

/** This calendar year's data, for the chart's "año en curso" line — see getYearMonthlyTemperature. */
export async function getCurrentYearMonthlyTemperature(lon: number, lat: number): Promise<CurrentYearMonthlyTempPoint[]> {
  return getYearMonthlyTemperature(lon, lat, new Date().getUTCFullYear())
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
