import "server-only"

/**
 * Second histogram above the clima report card: temperature counterpart to
 * lib/precipitacion/openmeteo-quinquenal-climatology.ts. Instead of the
 * decadal chart's 10-year windows, this averages Open-Meteo's daily
 * *maximum* temperature across consecutive 5-year windows starting in 1999 — finer
 * bins make a recent warming/cooling shift visible in a way the 50-year
 * decadal chart above it smooths away, at the cost of each bucket resting
 * on only 5 years of data.
 *
 * Same archive endpoint as lib/clima/openmeteo-historical-client.ts.
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
 * current year and the year before it (see getRecentPastYears in
 * openmeteo-historical-client.ts). Computed relative to `referenceDate`
 * so a new bin appears automatically once 5 more years have passed.
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

export interface QuinquenioMonthlyTempPoint {
  month: number
  /** Average of daily maximum temperature (°C) across this month, averaged again across the bin's 5 years, or null if none had valid data. */
  tempC: number | null
}

export interface QuinquenioTempSeries extends QuinquenioBin {
  meses: QuinquenioMonthlyTempPoint[]
}

/**
 * Fetches one point's entire daily mean-temperature history across every
 * bin in one request, then buckets it first by calendar year+month, then
 * averages each month across the 5 years inside each bin.
 */
export async function getQuinquenioMonthlyTempClimatology(
  lon: number,
  lat: number,
  referenceDate: Date = new Date(),
): Promise<QuinquenioTempSeries[]> {
  const bins = getQuinquenioBins(referenceDate)
  if (bins.length === 0) return []

  const startYear = bins[0].inicio
  const endYear = bins[bins.length - 1].fin

  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "temperature_2m_max",
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
  const maxes = (data?.daily?.temperature_2m_max ?? []) as Array<number | null>

  const dailyByYearMonth = new Map<string, number[]>()
  for (let i = 0; i < times.length; i++) {
    const value = maxes[i]
    if (typeof value !== "number") continue
    const year = times[i].slice(0, 4)
    const month = times[i].slice(5, 7)
    const key = `${year}-${month}`
    if (!dailyByYearMonth.has(key)) dailyByYearMonth.set(key, [])
    dailyByYearMonth.get(key)!.push(value)
  }

  function monthAverageForYear(year: number, month: number): number | null {
    const days = dailyByYearMonth.get(`${year}-${String(month).padStart(2, "0")}`)
    if (!days || days.length === 0) return null
    return days.reduce((sum, v) => sum + v, 0) / days.length
  }

  return bins.map((bin) => {
    const meses: QuinquenioMonthlyTempPoint[] = []
    for (let month = 1; month <= 12; month++) {
      const yearAverages: number[] = []
      for (let year = bin.inicio; year <= bin.fin; year++) {
        const avg = monthAverageForYear(year, month)
        if (avg != null) yearAverages.push(avg)
      }
      meses.push({
        month,
        tempC:
          yearAverages.length > 0
            ? Math.round((yearAverages.reduce((sum, v) => sum + v, 0) / yearAverages.length) * 10) / 10
            : null,
      })
    }
    return { ...bin, meses }
  })
}
