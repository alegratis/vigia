import "server-only"

/**
 * Client for Open-Meteo's Historical Weather API (archive-api.open-meteo.com)
 * — used for the "current year" comparison line on the climatology chart
 * instead of NASA POWER (see power-client.ts).
 *
 * Why swap sources: NASA POWER's near-real-time layer is GPM IMERG, a
 * satellite retrieval that infers rain from cloud-top brightness/temperature.
 * Over cloudy, mountainous terrain like the Sevilla/Zarzal/Caicedonia
 * escarpment it can badly overestimate — it was observed showing more than
 * double the actual rainfall for a month that was confirmed on the ground
 * to be well below normal. Open-Meteo's "best match" archive blends
 * ECMWF IFS HRES analysis (which assimilates real surface-station and
 * radiosonde observations, not just satellite imagery) for the most recent
 * ~2 months with ERA5/ERA5-Land reanalysis further back. Neither is a raw
 * rain gauge, but assimilated-analysis precipitation is materially more
 * trustworthy than satellite-only retrieval for this kind of terrain.
 *
 * No API key, CORS-enabled, free for non-commercial use.
 */

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

// Same rationale as power-client.ts / forecast-client.ts: recent days can still
// be revised as better observations come in, so keep the TTL modest.
const REVALIDATE_SECONDS = 3600

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export interface CurrentYearMonthlyPoint {
  month: number
  /** Sum of daily precipitation_sum for this month, in mm — null if Open-Meteo has no data for it yet. */
  mm: number | null
  validDays: number
  /** True only for the current, still-in-progress month (a partial-month sum, not a full-month total). */
  isPartial: boolean
}

/**
 * Fetches this calendar year's daily rainfall (Jan 1 through today) for one
 * point and buckets it into 12 monthly sums, for the "current year" line on
 * the vereda/municipio climatology chart. Months after the current one are
 * `null` (no data yet, not zero) rather than plotted as zero rainfall. The
 * current month's value is a partial-month sum through today, flagged with
 * `isPartial` so the UI can label it as still in progress.
 */
export async function getCurrentYearMonthlyPrecipitation(lon: number, lat: number): Promise<CurrentYearMonthlyPoint[]> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth() + 1

  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "precipitation_sum",
    timezone: "America/Bogota",
    start_date: `${year}-01-01`,
    end_date: formatDate(now),
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

  const byMonth = new Map<number, number[]>()
  for (let i = 0; i < times.length; i++) {
    const value = sums[i]
    if (typeof value !== "number") continue
    const month = Number(times[i].slice(5, 7))
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month)!.push(value)
  }

  const months: CurrentYearMonthlyPoint[] = []
  for (let month = 1; month <= 12; month++) {
    if (month > currentMonth) {
      months.push({ month, mm: null, validDays: 0, isPartial: false })
      continue
    }
    const values = byMonth.get(month) ?? []
    months.push({
      month,
      mm: values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) * 10) / 10 : null,
      validDays: values.length,
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
