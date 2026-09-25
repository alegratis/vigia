import "server-only"

/**
 * Replacement for the old IDEAM-normal histogram at the top of the
 * precipitación panel: that one queried IDEAM's published 1991-2020 and
 * 1981-2010 normal-climatology raster (visualizador.ideam.gov.co), which
 * has been down and returning no data. This computes the same kind of
 * "long-run normal" directly from Open-Meteo's historical archive — the
 * same source and endpoint as openmeteo-quinquenal-climatology.ts below
 * it on the panel — bucketed into three consecutive 10-year windows
 * instead of that module's 5-year windows, for a longer look back (30
 * years total) at the cost of finer within-window detail.
 *
 * Same archive endpoint and "why Open-Meteo, not NASA POWER" rationale as
 * openmeteo-historical-client.ts's getYearMonthlyPrecipitation.
 */

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

// Every year in these bins is a complete, settled past year (never the current or a recent year — see
// getDecadaBins), so unlike the current-year fetch this can cache far longer.
const REVALIDATE_SECONDS = 3600 * 24

const BIN_LENGTH_YEARS = 10
const NUM_BINS = 3

/** A non-overlapping 10-year window, e.g. { inicio: 1994, fin: 2003 }. */
export interface DecadaBin {
  inicio: number
  fin: number
}

/**
 * The three most recent complete 10-year bins, ending 3 years before
 * `referenceDate`'s year — the current year and the two before it are
 * shown individually elsewhere on the chart (see
 * openmeteo-historical-client.ts's getRecentPastYears), same convention as
 * openmeteo-quinquenal-climatology.ts's getQuinquenioBins. Computed
 * backward from the last binnable year rather than forward from a fixed
 * start year, so the three decades always mean "last 10 years, the 10
 * before that, and the 10 before that" relative to today instead of
 * drifting to some other fixed range — e.g. today (2026) yields
 * [1994-2003, 2004-2013, 2014-2023].
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

export interface DecadaMonthlyPoint {
  month: number
  /** Average of this month's full-month total (mm) across the bin's 10 years, or null if none had valid data. */
  mm: number | null
}

export interface DecadaSeries extends DecadaBin {
  meses: DecadaMonthlyPoint[]
}

/**
 * Fetches one point's entire daily rainfall history across every bin in
 * one request (e.g. 1994-01-01 through 2023-12-31 today, 30 years in a
 * single call rather than 3 separate ones), then buckets it first by
 * calendar year+month, then averages each month across the 10 years
 * inside each bin.
 */
export async function getDecadaMonthlyClimatology(
  lon: number,
  lat: number,
  referenceDate: Date = new Date(),
): Promise<DecadaSeries[]> {
  const bins = getDecadaBins(referenceDate)
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
    const meses: DecadaMonthlyPoint[] = []
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

/** Batched version of getDecadaMonthlyClimatology, for averaging across every vereda in a municipio. */
export async function getDecadaMonthlyClimatologyBatch(
  points: Array<{ lon: number; lat: number }>,
  referenceDate: Date = new Date(),
  concurrency = 6,
): Promise<Array<DecadaSeries[] | null>> {
  const results: Array<DecadaSeries[] | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await getDecadaMonthlyClimatology(p.lon, p.lat, referenceDate)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
