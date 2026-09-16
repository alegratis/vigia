import "server-only"

/**
 * Shared NWP (numerical weather prediction) point predictors from
 * Open-Meteo's forecast API — the same class of model output windy.com
 * visualizes (ECMWF/GFS/ICON), queried per point rather than rendered as a
 * raster. One request per centroid yields every field both hazard models
 * need, so adding these predictors costs a single extra fan-out on the
 * per-vereda aggregate instead of one per predictor:
 *
 * - Landslide gets near-surface **soil moisture** (0–7 cm), a direct
 *   wetness state that complements the antecedent-rainfall trigger.
 * - Fire-weather gets **vapor-pressure deficit** (from temperature + relative
 *   humidity), **wind speed**, and a **dry-spell** length (days since
 *   meaningful rain) — the atmospheric drivers behind a fire-weather index.
 *
 * All fields are best-effort: a point that fails resolves to `null`s rather
 * than failing the batch, matching the rainfall trigger's convention.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
const REVALIDATE_SECONDS = 3600

/** Soil moisture (m³/m³) at/above which the landslide wetness factor saturates to 1. */
const SOIL_SATURATION = 0.4
/** VPD (kPa) at/above which the fire dryness factor saturates to 1. */
const VPD_SATURATION_KPA = 3
/** Wind speed (km/h) at/above which the fire wind factor saturates to 1. */
const WIND_SATURATION_KPH = 40
/** Consecutive dry days at/above which the fire dry-spell factor saturates to 1. */
const DRY_SPELL_SATURATION_DAYS = 14
/** A day with less than this much rain (mm) counts as "dry" for the dry-spell length. */
const DRY_DAY_THRESHOLD_MM = 1

export interface NwpConditions {
  /** Volumetric soil moisture 0–7 cm (m³/m³), or null. */
  soilMoisture: number | null
  /** Vapor-pressure deficit (kPa) from current temp + RH, or null. */
  vpdKpa: number | null
  /** Current 10 m wind speed (km/h), or null. */
  windKph: number | null
  /** Consecutive dry days ending today (see DRY_DAY_THRESHOLD_MM), or null. */
  dryDays: number | null
}

const EMPTY: NwpConditions = { soilMoisture: null, vpdKpa: null, windKph: null, dryDays: null }

/** Saturation-vapor-pressure (kPa) via the Tetens formula. */
function saturationVaporPressure(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}

async function fetchOne(lat: number, lon: number): Promise<NwpConditions> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,soil_moisture_0_to_7cm",
    daily: "precipitation_sum",
    past_days: "14",
    forecast_days: "1",
    timezone: "UTC",
  })
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) throw new Error(`Open-Meteo forecast query failed (${res.status})`)
  const data = await res.json()

  const current = data?.current ?? {}
  const tempC = typeof current.temperature_2m === "number" ? current.temperature_2m : null
  const rh = typeof current.relative_humidity_2m === "number" ? current.relative_humidity_2m : null
  const windKph = typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null
  const soilMoisture =
    typeof current.soil_moisture_0_to_7cm === "number" ? current.soil_moisture_0_to_7cm : null

  const vpdKpa =
    tempC != null && rh != null
      ? Math.max(0, saturationVaporPressure(tempC) * (1 - rh / 100))
      : null

  // Count consecutive dry days working backward from the most recent day.
  const rain = (data?.daily?.precipitation_sum ?? []) as Array<number | null>
  let dryDays: number | null = null
  if (rain.length > 0) {
    dryDays = 0
    for (let i = rain.length - 1; i >= 0; i--) {
      if ((rain[i] ?? 0) < DRY_DAY_THRESHOLD_MM) dryDays++
      else break
    }
  }

  return { soilMoisture, vpdKpa, windKph, dryDays }
}

/** 0–1 landslide wetness factor from soil moisture, or null if unavailable. */
export function soilMoistureScore(c: NwpConditions): number | null {
  if (c.soilMoisture == null) return null
  return Math.max(0, Math.min(1, c.soilMoisture / SOIL_SATURATION))
}

/**
 * 0–1 fire-weather score blending dryness (VPD), wind and dry-spell length —
 * higher means hotter/drier/windier. Null only if every input is missing.
 */
export function fireWeatherScore(c: NwpConditions): number | null {
  const parts: Array<{ value: number; weight: number }> = []
  if (c.vpdKpa != null) parts.push({ value: Math.min(1, c.vpdKpa / VPD_SATURATION_KPA), weight: 0.5 })
  if (c.windKph != null) parts.push({ value: Math.min(1, c.windKph / WIND_SATURATION_KPH), weight: 0.2 })
  if (c.dryDays != null)
    parts.push({ value: Math.min(1, c.dryDays / DRY_SPELL_SATURATION_DAYS), weight: 0.3 })
  if (parts.length === 0) return null
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0)
  return parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight
}

/**
 * Batched conditions fetch, same bounded worker-pool pattern as the rainfall
 * trigger — a failed point falls back to all-`null` rather than failing the
 * whole batch.
 */
export async function getNwpConditionsBatch(
  points: Array<{ lat: number; lon: number }>,
  concurrency = 6,
): Promise<NwpConditions[]> {
  const results: NwpConditions[] = new Array(points.length).fill(EMPTY)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await fetchOne(p.lat, p.lon)
      } catch {
        results[index] = EMPTY
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
