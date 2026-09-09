import "server-only"

/**
 * Rainfall trigger — the dynamic "nowcast" half of the self-computed
 * hazard model (see hazard-model.ts), adapted from NASA's LHASA v1
 * approach of comparing a decayed antecedent-rainfall index against its
 * own historical climatology to flag anomalously wet conditions, rather
 * than using rainfall totals in absolute terms (a decent-sized storm reads
 * very differently in a normally dry month than a normally wet one).
 *
 * Both the current index and its historical baseline are computed from
 * the same Open-Meteo Historical Weather API (archive-api.open-meteo.com)
 * already used for the climatology chart (see
 * lib/precipitacion/openmeteo-historical-client.ts) — one continuous
 * multi-year request per point, sliced locally into the current window
 * plus the same calendar window in each of the past few years, instead of
 * one request per window (4x fewer calls for the same coverage).
 */

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

// Recent days can still be revised as better observations come in; same
// modest TTL as the rest of the precipitacion module.
const REVALIDATE_SECONDS = 3600

/** How many trailing days feed the decayed antecedent-rainfall index. */
const ANTECEDENT_WINDOW_DAYS = 15
/** Half-life (days) of the decay weighting — emphasizes the last few days over the rest of the window. */
const DECAY_HALF_LIFE_DAYS = 4
/** How many past years' same-calendar-window index to average into the baseline. */
const BASELINE_YEARS_BACK = 3
/** Ratio of current-to-baseline index at/above which the trigger score saturates to 1. */
const SATURATION_RATIO = 2

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Weights `days[0]` (most recent) highest, decaying by half every DECAY_HALF_LIFE_DAYS. */
function decayWeightedSum(days: number[]): number {
  let sum = 0
  for (let i = 0; i < days.length; i++) {
    sum += days[i] * Math.pow(0.5, i / DECAY_HALF_LIFE_DAYS)
  }
  return sum
}

async function fetchDailyPrecipByDate(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<Map<string, number>> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    daily: "precipitation_sum",
    timezone: "UTC",
    start_date: startDate,
    end_date: endDate,
  })
  const res = await fetch(`${ARCHIVE_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) throw new Error(`Open-Meteo archive query failed (${res.status})`)
  const data = await res.json()
  const times = (data?.daily?.time ?? []) as string[]
  const sums = (data?.daily?.precipitation_sum ?? []) as Array<number | null>

  const byDate = new Map<string, number>()
  for (let i = 0; i < times.length; i++) {
    byDate.set(times[i], typeof sums[i] === "number" ? sums[i]! : 0)
  }
  return byDate
}

export interface RainfallTrigger {
  /** Current decayed antecedent-rainfall index divided by its historical same-season baseline, or `null` if no baseline could be computed. */
  ratio: number | null
  /** 0–1: how far `ratio` sits above normal, saturating at SATURATION_RATIO. 0 if data is missing (treated as "no anomaly detected" rather than skipped). */
  score: number
}

async function computeOne(lat: number, lon: number): Promise<RainfallTrigger> {
  // The archive API lags real time by roughly a day; anchor "today" one day
  // back so the most recent window day isn't silently zero from missing data.
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)
  const rangeStart = new Date(end)
  rangeStart.setUTCFullYear(rangeStart.getUTCFullYear() - BASELINE_YEARS_BACK)
  rangeStart.setUTCDate(rangeStart.getUTCDate() - ANTECEDENT_WINDOW_DAYS)

  const byDate = await fetchDailyPrecipByDate(lat, lon, formatDate(rangeStart), formatDate(end))

  function windowIndex(windowEnd: Date): number {
    const days: number[] = []
    for (let i = 0; i < ANTECEDENT_WINDOW_DAYS; i++) {
      const d = new Date(windowEnd)
      d.setUTCDate(d.getUTCDate() - i)
      days.push(byDate.get(formatDate(d)) ?? 0)
    }
    return decayWeightedSum(days)
  }

  const currentIndex = windowIndex(end)

  const baselineIndexes: number[] = []
  for (let yearsBack = 1; yearsBack <= BASELINE_YEARS_BACK; yearsBack++) {
    const baselineEnd = new Date(end)
    baselineEnd.setUTCFullYear(baselineEnd.getUTCFullYear() - yearsBack)
    baselineIndexes.push(windowIndex(baselineEnd))
  }

  const baselineIndex = baselineIndexes.reduce((sum, v) => sum + v, 0) / baselineIndexes.length

  if (baselineIndex <= 0) {
    // No historical rainfall in this same-season window at all — can't form
    // a ratio; treat any current rainfall as a full anomaly, none as none.
    return { ratio: null, score: currentIndex > 0 ? 1 : 0 }
  }

  const ratio = currentIndex / baselineIndex
  const score = Math.max(0, Math.min(1, (ratio - 1) / (SATURATION_RATIO - 1)))
  return { ratio, score }
}

/**
 * Batched version of the rainfall trigger, same worker-pool pattern as
 * getYearMonthlyPrecipitationBatch — a failed point falls back to `{
 * ratio: null, score: 0 }` (no detected anomaly) rather than failing the
 * whole batch.
 */
export async function computeRainfallTriggerBatch(
  points: Array<{ lat: number; lon: number }>,
  concurrency = 6,
): Promise<RainfallTrigger[]> {
  const results: RainfallTrigger[] = new Array(points.length).fill({ ratio: null, score: 0 })
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await computeOne(p.lat, p.lon)
      } catch {
        results[index] = { ratio: null, score: 0 }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
