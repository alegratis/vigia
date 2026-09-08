import "server-only"

import { FORECAST_WINDOW_OPTIONS, type ForecastWindowDays } from "./api-types"

export { FORECAST_WINDOW_OPTIONS }
export type { ForecastWindowDays }

/**
 * Client for Open-Meteo's free daily forecast API (open-meteo.com) — open,
 * CORS-enabled, no API key or signup needed. Queried once per vereda
 * centroid for `precipitation_sum` (mm/day) and `precipitation_probability_max`
 * (%), the same fan-out shape as lib/precipitacion/power-client.ts.
 *
 * Unlike NASA POWER (backward-looking reanalysis, see power-client.ts),
 * this is genuinely forward-looking: Open-Meteo blends multiple national
 * weather-service NWP models (GFS, ECMWF, ICON, etc.) into a single daily
 * forecast, available up to 16 days ahead. Confirmed working via a manual
 * request while building this — no auth, JSON response, `daily.time` /
 * `daily.precipitation_sum` / `daily.precipitation_probability_max` arrays
 * aligned by index.
 *
 * Coordinates are rounded to 2 decimal places (~1.1 km), same rationale as
 * power-client.ts: keeps nearby veredas sharing one cached query without
 * losing meaningful accuracy at this forecast model's native resolution.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

const REVALIDATE_SECONDS = 10800 // 3h — matches power-client.ts; Open-Meteo's own models update a few times a day.

export interface PrecipitationForecast {
  /** Sum of `precipitation_sum` (mm) over the requested forecast days. */
  accumulatedMm: number
  /** Number of forecast days actually returned — normally equal to the requested window. */
  validDays: number
  /** Max of `precipitation_probability_max` (%) across the forecast days — a headline "how likely" figure. */
  probabilidadMax: number
}

/**
 * Fetches a forecast for one point over the given window (7 or 14 days
 * ahead). Returns `null` if Open-Meteo has no daily data at all.
 */
export async function getForecastPrecipitation(
  lon: number,
  lat: number,
  windowDays: ForecastWindowDays = 7,
): Promise<PrecipitationForecast | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    daily: "precipitation_sum,precipitation_probability_max",
    timezone: "America/Bogota",
    forecast_days: String(windowDays),
  })

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast query failed (${res.status})`)
  }
  const data = await res.json()
  const sums = data?.daily?.precipitation_sum as number[] | undefined
  const probabilities = data?.daily?.precipitation_probability_max as number[] | undefined
  if (!sums || sums.length === 0) return null

  const validSums = sums.filter((v) => typeof v === "number")
  if (validSums.length === 0) return null

  return {
    accumulatedMm: validSums.reduce((sum, v) => sum + v, 0),
    validDays: validSums.length,
    probabilidadMax: probabilities?.length ? Math.max(...probabilities.filter((v) => typeof v === "number")) : 0,
  }
}

/**
 * Fetches forecasts for many points with a concurrency cap, mirroring
 * getAccumulatedPrecipitationBatch in power-client.ts. Returns results in
 * the same order as `points`, with `null` for any point that failed.
 */
export async function getForecastPrecipitationBatch(
  points: Array<{ lon: number; lat: number }>,
  windowDays: ForecastWindowDays = 7,
  concurrency = 6,
): Promise<Array<PrecipitationForecast | null>> {
  const results: Array<PrecipitationForecast | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await getForecastPrecipitation(p.lon, p.lat, windowDays)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
