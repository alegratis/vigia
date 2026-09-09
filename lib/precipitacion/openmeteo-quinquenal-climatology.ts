import "server-only"

/**
 * Second, Open-Meteo-only climatology for the precipitación panel: instead
 * of IDEAM's two published 30-year normal periods (1991-2020, 1981-2010 —
 * see ideam-climatology.ts), this computes our own monthly averages
 * directly from Open-Meteo's historical archive over consecutive 5-year
 * windows starting in 1999. Finer 5-year buckets make recent-decade shifts
 * visible in a way a single 30-year normal smooths away, at the cost of
 * each bucket resting on only 5 years of data instead of 30.
 *
 * Same archive endpoint and "why Open-Meteo, not NASA POWER" rationale as
 * openmeteo-historical-client.ts's getYearMonthlyPrecipitation.
 */

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

// Every year in these bins is a complete, settled past year (never the current or a recent year — see
// getQuinquenioBins), so unlike the current-year fetch this can cache far longer.
const REVALIDATE_SECONDS = 3600 * 24

export const QUINQUENIO_START_YEAR = 1999
const BIN_LENGTH_YEARS = 5

/** A non-overlapping 5-year window, e.g. { inicio: 1999, fin: 2003 }. */
export interface QuinquenioBin {
  inicio: number
  fin: number
}

/**
 * Every complete 5-year bin from `QUINQUENIO_START_YEAR` up to (but not
 * including) the years shown individually elsewhere on the chart — the
 * current year and the two before it (see
 * openmeteo-historical-client.ts's getRecentPastYears). Computed relative
 * to `referenceDate` rather than hardcoded so a new bin appears
 * automatically once 5 more years have passed, e.g. today (2026) yields
 * [1999-2003, 2004-2008, 2009-2013, 2014-2018, 2019-2023] — 2024 and 2025
 * are left out of the bins because they're already covered individually.
 */
export function getQuinquenioBins(referenceDate: Date = new Date()): QuinquenioBin[] {
  const currentYear = referenceDate.getUTCFullYear()
  const lastBinnableYear = currentYear - 3
  const bins: QuinquenioBin[] = []
  for (
    let inicio = QUINQUENIO_START_YEAR;
    inicio + BIN_LENGTH_YEARS - 1 <= lastBinnableYear;
    inicio += BIN_LENGTH_YEARS
  ) {
    bins.push({ inicio, fin: inicio + BIN_LENGTH_YEARS - 1 })
  }
  return bins
}

export interface QuinquenioMonthlyPoint {
  month: number
  /** Average of this month's full-month total (mm) across the bin's 5 years, or null if none had valid data. */
  mm: number | null
}

export interface QuinquenioSeries extends QuinquenioBin {
  meses: QuinquenioMonthlyPoint[]
}

/**
 * Fetches one point's entire daily rainfall history across every bin in
 * one request (e.g. 1999-01-01 through 2023-12-31 today, ~25 years in a
 * single call rather than 5 separate ones), then buckets it first by
 * calendar year+month, then averages each month across the 5 years inside
 * each bin.
 */
export async function getQuinquenioMonthlyClimatology(
  lon: number,
  lat: number,
  referenceDate: Date = new Date(),
): Promise<QuinquenioSeries[]> {
  const bins = getQuinquenioBins(referenceDate)
  if (bins.length === 0) return []

  const startYear = bins[0].inicio
  const endYear = bins[bins.length - 1].fin

  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "precipitation_sum",
    timezone: "America/Bogota",
    start_date: `${startYear}-01-01`,
    end_date: `${endYear}-12-31`,
  })

  const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`Open-Meteo archive query failed (${res.status})`)
  }
  const data = await res.json()
  const times = (data?.daily?.time ?? []) as string[]
  const sums = (data?.daily?.precipitation_sum ?? []) as Array<number | null>

  const dailyByYearMonth = new Map<string, number[]>()
  for (let i = 0; i < times.length; i++) {
    const value = sums[i]
    if (typeof value !== "number") continue
    const year = times[i].slice(0, 4)
    const month = times[i].slice(5, 7)
    const key = `${year}-${month}`
    if (!dailyByYearMonth.has(key)) dailyByYearMonth.set(key, [])
    dailyByYearMonth.get(key)!.push(value)
  }

  function monthTotalForYear(year: number, month: number): number | null {
    const days = dailyByYearMonth.get(`${year}-${String(month).padStart(2, "0")}`)
    if (!days || days.length === 0) return null
    return days.reduce((sum, v) => sum + v, 0)
  }

  return bins.map((bin) => {
    const meses: QuinquenioMonthlyPoint[] = []
    for (let month = 1; month <= 12; month++) {
      const yearTotals: number[] = []
      for (let year = bin.inicio; year <= bin.fin; year++) {
        const total = monthTotalForYear(year, month)
        if (total != null) yearTotals.push(total)
      }
      meses.push({
        month,
        mm: yearTotals.length > 0 ? Math.round((yearTotals.reduce((sum, v) => sum + v, 0) / yearTotals.length) * 10) / 10 : null,
      })
    }
    return { ...bin, meses }
  })
}

/** Batched version of getQuinquenioMonthlyClimatology, for averaging across every vereda in a municipio. */
export async function getQuinquenioMonthlyClimatologyBatch(
  points: Array<{ lon: number; lat: number }>,
  referenceDate: Date = new Date(),
  concurrency = 6,
): Promise<Array<QuinquenioSeries[] | null>> {
  const results: Array<QuinquenioSeries[] | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await getQuinquenioMonthlyClimatology(p.lon, p.lat, referenceDate)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
