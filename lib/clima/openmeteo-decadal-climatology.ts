import "server-only"

/**
 * First histogram above the clima report card: temperature counterpart to
 * lib/precipitacion/openmeteo-decadal-climatology.ts. Instead of summing
 * rainfall per month, this averages Open-Meteo's daily mean temperature
 * across each month, bucketed into five consecutive 10-year windows (50
 * years total) — a long look-back meant to make a gradual warming trend
 * visible in a way a single normal period would smooth away.
 *
 * Same archive endpoint as lib/clima/openmeteo-historical-client.ts.
 */

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

// Every year in these bins is a complete, settled past year (never the current or a recent year — see
// getDecadaBins), so unlike the current-year fetch this can cache far longer.
const REVALIDATE_SECONDS = 3600 * 24

const BIN_LENGTH_YEARS = 10
const NUM_BINS = 5

/** A non-overlapping 10-year window, e.g. { inicio: 1994, fin: 2003 }. */
export interface DecadaBin {
  inicio: number
  fin: number
}

/**
 * The five most recent complete 10-year bins, ending 3 years before
 * `referenceDate`'s year — the current year and the two before it are
 * shown individually elsewhere on the chart (see
 * getRecentPastYears in openmeteo-historical-client.ts), same convention
 * as the precipitación decadal chart. Computed backward from the last
 * binnable year so the five decades always mean "the last 10 years, and
 * the four consecutive 10-year windows before that" relative to today.
 */
export function getDecadaBins(referenceDate: Date = new Date()): DecadaBin[] {
  const currentYear = referenceDate.getUTCFullYear()
  const lastBinnableYear = currentYear - 3
  const bins: DecadaBin[] = []
  for (let i = NUM_BINS - 1; i >= 0; i--) {
    const fin = lastBinnableYear - i * BIN_LENGTH_YEARS
    const inicio = fin - BIN_LENGTH_YEARS + 1
    bins.push({ inicio, fin })
  }
  return bins
}

export interface DecadaMonthlyTempPoint {
  month: number
  /** Average of daily mean temperature (°C) across this month, averaged again across the bin's 10 years, or null if none had valid data. */
  tempC: number | null
}

export interface DecadaTempSeries extends DecadaBin {
  meses: DecadaMonthlyTempPoint[]
}

/**
 * Fetches one point's entire daily mean-temperature history across every
 * bin in one request, then buckets it first by calendar year+month, then
 * averages each month across the 10 years inside each bin.
 */
export async function getDecadaMonthlyTempClimatology(
  lon: number,
  lat: number,
  referenceDate: Date = new Date(),
): Promise<DecadaTempSeries[]> {
  const bins = getDecadaBins(referenceDate)
  if (bins.length === 0) return []

  const startYear = bins[0].inicio
  const endYear = bins[bins.length - 1].fin

  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "temperature_2m_mean",
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
  const means = (data?.daily?.temperature_2m_mean ?? []) as Array<number | null>

  const dailyByYearMonth = new Map<string, number[]>()
  for (let i = 0; i < times.length; i++) {
    const value = means[i]
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
    const meses: DecadaMonthlyTempPoint[] = []
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
