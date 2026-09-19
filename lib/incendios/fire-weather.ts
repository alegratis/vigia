import "server-only"

/**
 * Fire Weather Index (FWI) — the dynamic "today's fire weather" half of
 * the self-computed forest-fire hazard model (see hazard-model.ts): the
 * Canadian Forest Fire Weather Index System (Van Wagner 1987; Van Wagner
 * & Pickett 1985), the same public-domain, internationally standard
 * algorithm behind the GWIS/Copernicus EFFIS `ecmwf.fwi` layer already
 * shown as an optional forecast overlay on this map (see gwis.ts). That
 * WMS layer is tile-only — its GetCapabilities reports `queryable="0"`,
 * the same limitation gwis.ts already documents for its land-cover
 * layer — so there's no way to read a per-point FWI value out of it.
 * This instead computes the same standard equations directly from raw
 * weather data, the same way the landslide model replicates LHASA's
 * structure rather than reading NASA's own LHASA output.
 *
 * Every formula below is transcribed one-to-one (same equation numbers,
 * same constants) from the Canadian Forest Service's own reference
 * implementation — the `cffdrs` R package's `fine_fuel_moisture_code` /
 * `duff_moisture_code` / `drought_code` / `initial_spread_index` /
 * `buildup_index` / `fire_weather_index` — not reconstructed from memory.
 * See https://cfs.nrcan.gc.ca/pubwarehouse/pdfs/19927.pdf (Van Wagner
 * 1987) and https://cfs.nrcan.gc.ca/pubwarehouse/pdfs/19973.pdf (Van
 * Wagner & Pickett 1985) for the underlying reference.
 *
 * The FFMC/DMC/DC fuel-moisture codes are recursive, day-over-day
 * bookkeeping — each day's value depends on the previous day's — so a
 * single day's weather isn't enough to read them cold. Each centroid is
 * "spun up" from SPINUP_DAYS of daily weather (Open-Meteo's historical
 * archive API, the same one rainfall-trigger.ts already uses) starting
 * from the CFS's standard spring startup values, long enough for DC (the
 * slowest-decaying of the three codes) to converge away from that
 * arbitrary starting point before reading today's codes.
 */

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
const REVALIDATE_SECONDS = 3600

/** Days of daily weather used to spin up FFMC/DMC/DC before reading today's value — long enough for DC's slow day-to-day decay to converge. */
const SPINUP_DAYS = 60
/** CFS standard startup values, meant for spring conditions in temperate latitudes — the best available default, since this system has no published startup for equatorial Colombia. */
const STANDARD_STARTUP = { ffmc: 85, dmc: 6, dc: 15 }
/** FWI value at/above which the composite score saturates to 1 — the Van Wagner "Extreme" class boundary. */
const MAX_FWI_FOR_SCORE = 30

// Used in conversion between FFMC and moisture content (Eq. 1, cffdrs fine_fuel_moisture_code.r).
const FFMC_COEFFICIENT = (250.0 * 59.5) / 101.0

/** Day-length factor table for DMC (Eq. 16), by latitude band, indexed Jan=0..Dec=11. */
const DMC_DAY_LENGTH_46N = [6.5, 7.5, 9, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8, 7, 6]
const DMC_DAY_LENGTH_20N = [7.9, 8.4, 8.9, 9.5, 9.9, 10.2, 10.1, 9.7, 9.1, 8.6, 8.1, 7.8]
const DMC_DAY_LENGTH_20S = [10.1, 9.6, 9.1, 8.5, 8.1, 7.8, 7.9, 8.3, 8.9, 9.4, 9.9, 10.2]
const DMC_DAY_LENGTH_40S = [11.5, 10.5, 9.2, 7.9, 6.8, 6.2, 6.5, 7.4, 8.7, 10, 11.2, 11.8]

/** Day-length factor table for DC (Eq. 22), by latitude band, indexed Jan=0..Dec=11. */
const DC_DAY_LENGTH_20N = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5, 2.4, 0.4, -1.6, -1.6]
const DC_DAY_LENGTH_20S = [6.4, 5, 2.4, 0.4, -1.6, -1.6, -1.6, -1.6, -1.6, 0.9, 3.8, 5.8]

/** This app's whole AOI sits at ~3.8–4.5°N — always inside the equatorial band that uses a flat, month-independent factor for both codes. */
function dmcDayLength(lat: number, monthIndex: number): number {
  if (lat <= 10 && lat > -10) return 9
  if (lat <= 30 && lat > 10) return DMC_DAY_LENGTH_20N[monthIndex]
  if (lat <= -10 && lat > -30) return DMC_DAY_LENGTH_20S[monthIndex]
  if (lat <= -30) return DMC_DAY_LENGTH_40S[monthIndex]
  return DMC_DAY_LENGTH_46N[monthIndex]
}

function dcDayLength(lat: number, monthIndex: number): number {
  if (lat > -20 && lat <= 20) return 1.4
  if (lat <= -20) return DC_DAY_LENGTH_20S[monthIndex]
  return DC_DAY_LENGTH_20N[monthIndex]
}

/** Eqs. 1–10 (Van Wagner & Pickett 1985), via cffdrs' fine_fuel_moisture_code(). */
function fineFuelMoistureCode(ffmcYda: number, temp: number, rh: number, ws: number, prec: number): number {
  let wmo = (FFMC_COEFFICIENT * (101 - ffmcYda)) / (59.5 + ffmcYda)
  if (prec > 0.5) {
    const ra = prec - 0.5
    wmo =
      wmo > 150
        ? wmo +
          0.0015 * (wmo - 150) * (wmo - 150) * Math.sqrt(ra) +
          42.5 * ra * Math.exp(-100 / (251 - wmo)) * (1 - Math.exp(-6.93 / ra))
        : wmo + 42.5 * ra * Math.exp(-100 / (251 - wmo)) * (1 - Math.exp(-6.93 / ra))
  }
  wmo = Math.min(wmo, 250)

  const ed =
    0.942 * rh ** 0.679 + 11 * Math.exp((rh - 100) / 10) + 0.18 * (21.1 - temp) * (1 - 1 / Math.exp(rh * 0.115))
  const ew =
    0.618 * rh ** 0.753 + 10 * Math.exp((rh - 100) / 10) + 0.18 * (21.1 - temp) * (1 - 1 / Math.exp(rh * 0.115))

  let wm: number
  if (wmo < ed && wmo < ew) {
    const z = 0.424 * (1 - ((100 - rh) / 100) ** 1.7) + 0.0694 * Math.sqrt(ws) * (1 - ((100 - rh) / 100) ** 8)
    const x = z * 0.581 * Math.exp(0.0365 * temp)
    wm = ew - (ew - wmo) / 10 ** x
  } else if (wmo > ed) {
    const z = 0.424 * (1 - (rh / 100) ** 1.7) + 0.0694 * Math.sqrt(ws) * (1 - (rh / 100) ** 8)
    const x = z * 0.581 * Math.exp(0.0365 * temp)
    wm = ed + (wmo - ed) / 10 ** x
  } else {
    wm = wmo
  }

  const ffmc = (59.5 * (250 - wm)) / (FFMC_COEFFICIENT + wm)
  return Math.min(101, Math.max(0, ffmc))
}

/** Eqs. 11–16 (Van Wagner & Pickett 1985), via cffdrs' duff_moisture_code(). */
function duffMoistureCode(
  dmcYda: number,
  tempIn: number,
  rh: number,
  prec: number,
  lat: number,
  monthIndex: number,
): number {
  const temp = Math.max(tempIn, -1.1)
  const ell = dmcDayLength(lat, monthIndex)
  const rk = 1.894 * (temp + 1.1) * (100 - rh) * ell * 1e-4

  let pr: number
  if (prec <= 1.5) {
    pr = dmcYda
  } else {
    const rw = 0.92 * prec - 1.27
    const wmi = 20 + 280 / Math.exp(0.023 * dmcYda)
    const b =
      dmcYda <= 33
        ? 100 / (0.5 + 0.3 * dmcYda)
        : dmcYda <= 65
          ? 14 - 1.3 * Math.log(dmcYda)
          : 6.2 * Math.log(dmcYda) - 17.2
    const wmr = wmi + (1000 * rw) / (48.77 + b * rw)
    pr = wmr > 20 ? 43.43 * (5.6348 - Math.log(wmr - 20)) : dmcYda
  }
  pr = Math.max(pr, 0)
  const dmc = pr + rk
  return Number.isFinite(dmc) ? Math.max(dmc, 0) : dmcYda
}

/** Eqs. 18–23 (Van Wagner & Pickett 1985), via cffdrs' drought_code(). */
function droughtCode(dcYda: number, tempIn: number, prec: number, lat: number, monthIndex: number): number {
  const temp = Math.max(tempIn, -2.8)
  const fl = dcDayLength(lat, monthIndex)
  const pe = Math.max((0.36 * (temp + 2.8) + fl) / 2, 0)

  const rw = 0.83 * prec - 1.27
  const smi = 800 * Math.exp(-dcYda / 400)
  const dr0 = Math.max(dcYda - 400 * Math.log(1 + (3.937 * rw) / smi), 0)
  const dr = prec <= 2.8 ? dcYda : dr0
  const dc = dr + pe
  return Number.isFinite(dc) ? Math.max(dc, 0) : dcYda
}

/** Eqs. 24–26, via cffdrs' initial_spread_index() (fbpMod branch unused — this is the FWI System's own ISI, not the FBP System's). */
function initialSpreadIndex(ffmc: number, ws: number): number {
  const fm = (FFMC_COEFFICIENT * (101 - ffmc)) / (59.5 + ffmc)
  const fW = Math.exp(0.05039 * ws)
  const fF = 91.9 * Math.exp(-0.1386 * fm) * (1 + fm ** 5.31 / 49_300_000)
  return 0.208 * fW * fF
}

/** Eq. 27, via cffdrs' buildup_index(). */
function buildupIndex(dmc: number, dc: number): number {
  const bui1 = dmc === 0 && dc === 0 ? 0 : (0.8 * dc * dmc) / (dmc + 0.4 * dc)
  const p = dmc === 0 ? 0 : (dmc - bui1) / dmc
  const cc = 0.92 + (0.0114 * dmc) ** 1.7
  const bui0 = Math.max(dmc - cc * p, 0)
  return bui1 < dmc ? bui0 : bui1
}

/** Eqs. 28–30, via cffdrs' fire_weather_index(). */
function fireWeatherIndex(isi: number, bui: number): number {
  const bb =
    bui > 80 ? 0.1 * isi * (1000 / (25 + 108.64 / Math.exp(0.023 * bui))) : 0.1 * isi * (0.626 * bui ** 0.809 + 2)
  return bb <= 1 ? bb : Math.exp(2.72 * (0.434 * Math.log(bb)) ** 0.647)
}

interface DailyWeather {
  monthIndex: number
  tempMax: number
  rhMin: number
  windMax: number
  precip: number
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function fetchDailyWeather(lat: number, lon: number, startDate: string, endDate: string): Promise<DailyWeather[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    daily: "temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,precipitation_sum",
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
  const tempMax = (data?.daily?.temperature_2m_max ?? []) as Array<number | null>
  const rhMin = (data?.daily?.relative_humidity_2m_min ?? []) as Array<number | null>
  const windMax = (data?.daily?.wind_speed_10m_max ?? []) as Array<number | null>
  const precip = (data?.daily?.precipitation_sum ?? []) as Array<number | null>

  return times.map((t, i) => ({
    monthIndex: Number.parseInt(t.slice(5, 7), 10) - 1,
    // Fall back to typical mid-elevation-tropical values on a missing day rather than
    // dropping it — skipping a day would misalign the recursive moisture codes by one step.
    tempMax: typeof tempMax[i] === "number" ? tempMax[i]! : 25,
    rhMin: typeof rhMin[i] === "number" ? Math.min(rhMin[i]!, 99.9999) : 60,
    windMax: typeof windMax[i] === "number" ? windMax[i]! : 8,
    precip: typeof precip[i] === "number" ? Math.max(precip[i]!, 0) : 0,
  }))
}

export interface FireWeatherResult {
  ffmc: number
  dmc: number
  dc: number
  isi: number
  bui: number
  fwi: number
  /** 0–1, saturating at MAX_FWI_FOR_SCORE. */
  score: number
}

async function computeOne(lat: number, lon: number): Promise<FireWeatherResult> {
  // The archive API lags real time by roughly a day, same as rainfall-trigger.ts.
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - SPINUP_DAYS)

  const days = await fetchDailyWeather(lat, lon, formatDate(start), formatDate(end))
  if (days.length === 0) throw new Error("Sin datos meteorológicos para el período de arranque")

  let ffmc = STANDARD_STARTUP.ffmc
  let dmc = STANDARD_STARTUP.dmc
  let dc = STANDARD_STARTUP.dc
  let lastWindMax = days[0].windMax

  for (const d of days) {
    ffmc = fineFuelMoistureCode(ffmc, d.tempMax, d.rhMin, d.windMax, d.precip)
    dmc = duffMoistureCode(dmc, d.tempMax, d.rhMin, d.precip, lat, d.monthIndex)
    dc = droughtCode(dc, d.tempMax, d.precip, lat, d.monthIndex)
    lastWindMax = d.windMax
  }

  const isi = initialSpreadIndex(ffmc, lastWindMax)
  const bui = buildupIndex(dmc, dc)
  const fwi = fireWeatherIndex(isi, bui)
  const score = Math.max(0, Math.min(1, fwi / MAX_FWI_FOR_SCORE))

  return { ffmc, dmc, dc, isi, bui, fwi, score }
}

/**
 * Batched version, same worker-pool pattern as
 * computeRainfallTriggerBatch — a failed point resolves to `null` rather
 * than failing the whole batch (see hazard-model.ts's per-factor
 * renormalization).
 */
export async function computeFireWeatherBatch(
  points: Array<{ lat: number; lon: number }>,
  concurrency = 6,
): Promise<Array<FireWeatherResult | null>> {
  const results: Array<FireWeatherResult | null> = new Array(points.length).fill(null)
  let cursor = 0

  async function worker() {
    while (cursor < points.length) {
      const index = cursor++
      const p = points[index]
      try {
        results[index] = await computeOne(p.lat, p.lon)
      } catch {
        results[index] = null
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker))
  return results
}
