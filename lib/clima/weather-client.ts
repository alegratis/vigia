import "server-only"

import { CLIMA_FORECAST_DAYS } from "./api-types"

/**
 * Client for Open-Meteo's free forecast API (open-meteo.com) — the same open,
 * CORS-enabled, key-less service the precipitación forecast uses (see
 * lib/precipitacion/forecast-client.ts), queried here for a conventional
 * weather report rather than rainfall alone: `current` temperature + WMO
 * weather code + day/night flag, plus a `daily` block (weather code, high,
 * low, rain probability and rain sum) over the next few days.
 *
 * Coordinates are rounded to 2 decimals (~1.1 km), matching the precipitación
 * client, so neighbouring vereda centroids share one cached query.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

// 1h — current conditions move faster than the 3h precipitation-accumulation cache.
const REVALIDATE_SECONDS = 3600

export interface WeatherDayRaw {
  fecha: string
  weatherCode: number
  tempMax: number | null
  tempMin: number | null
  probabilidadLluvia: number
  precipMm: number
}

export interface WeatherPoint {
  currentTemp: number | null
  /** Apparent ("feels-like") temperature, factoring wind, humidity and radiation. */
  currentApparent: number | null
  currentCode: number | null
  esDia: boolean
  dias: WeatherDayRaw[]
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export async function getWeatherPoint(
  lon: number,
  lat: number,
  forecastDays: number = CLIMA_FORECAST_DAYS,
): Promise<WeatherPoint | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    current: "temperature_2m,apparent_temperature,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
    timezone: "America/Bogota",
    forecast_days: String(forecastDays),
  })

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`Open-Meteo weather query failed (${res.status})`)
  }
  const data = await res.json()
  const daily = data?.daily
  const times = daily?.time as string[] | undefined
  if (!times || times.length === 0) return null

  const codes = (daily.weather_code ?? []) as number[]
  const maxs = (daily.temperature_2m_max ?? []) as (number | null)[]
  const mins = (daily.temperature_2m_min ?? []) as (number | null)[]
  const probs = (daily.precipitation_probability_max ?? []) as (number | null)[]
  const sums = (daily.precipitation_sum ?? []) as (number | null)[]

  const dias: WeatherDayRaw[] = times.map((fecha, i) => ({
    fecha,
    weatherCode: typeof codes[i] === "number" ? codes[i] : 0,
    tempMax: numOrNull(maxs[i]),
    tempMin: numOrNull(mins[i]),
    probabilidadLluvia: numOrNull(probs[i]) ?? 0,
    precipMm: numOrNull(sums[i]) ?? 0,
  }))

  const current = data?.current
  return {
    currentTemp: numOrNull(current?.temperature_2m),
    currentApparent: numOrNull(current?.apparent_temperature),
    currentCode: typeof current?.weather_code === "number" ? current.weather_code : null,
    esDia: current?.is_day === 1,
    dias,
  }
}

/**
 * Fetches weather for many points with a concurrency cap, mirroring
 * getForecastPrecipitationBatch in lib/precipitacion/forecast-client.ts.
 * Returns results in the same order as `points`, `null` for any failure.
 */
export async function getWeatherPointBatch(
  points: Array<{ lon: number; lat: number }>,
  forecastDays: number = CLIMA_FORECAST_DAYS,
  concurrency = 6,
): Promise<Array<WeatherPoint | null>> {
  const results: Array<WeatherPoint | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await getWeatherPoint(p.lon, p.lat, forecastDays)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
