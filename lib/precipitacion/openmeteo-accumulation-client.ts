import "server-only"

import { ACCUMULATION_WINDOW_OPTIONS, type AccumulationWindowDays } from "./api-types"

export { ACCUMULATION_WINDOW_OPTIONS }
export type { AccumulationWindowDays }

/**
 * Backward-looking rainfall accumulation from Open-Meteo's forecast endpoint
 * using `past_days` — open, CORS-enabled, no API key. Replaces NASA POWER for
 * the historical mode.
 *
 * Why the forecast endpoint and not the archive endpoint: the archive lags
 * the present by days, while `past_days` on the forecast endpoint stitches
 * together the analysis hours of recent model runs and reaches up to the
 * current day, which is as close to real time as open data offers here. The
 * values are model analyses (ECMWF IFS / ICON / GFS blend), not rain-gauge
 * readings, but they assimilate surface observations and do not show the
 * IMERG overestimate that made NASA POWER unreliable on this escarpment.
 *
 * Today is excluded from the sum: its daily total is still being filled in,
 * so the window is the `windowDays` complete days ending yesterday (Bogotá).
 *
 * Coordinates are rounded to 2 decimals (~1.1 km) so nearby veredas share
 * one cached request.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

const REVALIDATE_SECONDS = 3600

export interface PrecipitationAccumulation {
  /** Sum of the `windowDays` complete days ending yesterday, in mm. */
  accumulatedMm: number
  /** How many days actually had a value — normally equal to windowDays. */
  validDays: number
}

export async function getAccumulatedPrecipitation(
  lon: number,
  lat: number,
  windowDays: AccumulationWindowDays = 7,
): Promise<PrecipitationAccumulation | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "precipitation_sum",
    timezone: "America/Bogota",
    past_days: String(windowDays + 1),
    forecast_days: "1",
  })

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`Open-Meteo query failed (${res.status})`)
  }
  const data = await res.json()
  const sums = data?.daily?.precipitation_sum as Array<number | null> | undefined
  if (!sums || sums.length < 2) return null

  const completeDays = sums.slice(0, -1).slice(-windowDays)
  const validValues = completeDays.filter((v): v is number => typeof v === "number")
  if (validValues.length === 0) return null

  return {
    accumulatedMm: validValues.reduce((sum, v) => sum + v, 0),
    validDays: validValues.length,
  }
}

/** Fetches accumulations for many points with a concurrency cap; `null` for any point that failed or had no data. */
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
