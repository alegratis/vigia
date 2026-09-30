/** Client-safe response shapes and scales for /api/clima/forecast. No server imports. */

/** Days of forward-looking forecast requested from Open-Meteo (see lib/clima/weather-client.ts). */
export const CLIMA_FORECAST_DAYS = 7

/**
 * Coarse weather families derived from Open-Meteo's WMO `weather_code`
 * (see lib/clima/weather-codes.ts). Kept deliberately small so every code
 * maps to one recognizable glyph on the map and in the report card.
 */
export type WeatherGroup =
  | "despejado"
  | "parcial"
  | "nublado"
  | "niebla"
  | "llovizna"
  | "lluvia"
  | "aguacero"
  | "tormenta"
  | "nieve"

export interface ClimaDay {
  /** ISO date YYYY-MM-DD, in America/Bogota. */
  fecha: string
  weatherCode: number
  grupo: WeatherGroup
  tempMax: number | null
  tempMin: number | null
  /** Max daily precipitation probability (%). */
  probabilidadLluvia: number
  /** True when this day's forecast rainfall is under 1 mm — feeds the dry-spell (racha seca) outlook. */
  seco: boolean
}

/**
 * Temperature bands for the choropleth fill and legend. Elevation-driven in
 * this Andean study area, so these are meaningful (cool highlands vs. warm
 * valley floor around Zarzal) rather than seasonal.
 */
export const TEMP_LEVELS = ["Frío", "Fresco", "Templado", "Cálido", "Caluroso"] as const
export type TempLevel = (typeof TEMP_LEVELS)[number]

export function classifyTemp(tempC: number): TempLevel {
  if (tempC < 14) return "Frío"
  if (tempC < 18) return "Fresco"
  if (tempC < 22) return "Templado"
  if (tempC < 26) return "Cálido"
  return "Caluroso"
}

const TEMP_LEVEL_COLOR_TOKENS: Record<TempLevel, string> = {
  Frío: "var(--clima-frio)",
  Fresco: "var(--clima-fresco)",
  Templado: "var(--clima-templado)",
  Cálido: "var(--clima-calido)",
  Caluroso: "var(--clima-caluroso)",
}

/** Raw CSS color token for a temperature band, falling back to a neutral tone. */
export function tempLevelColorToken(level: string): string {
  return level in TEMP_LEVEL_COLOR_TOKENS
    ? TEMP_LEVEL_COLOR_TOKENS[level as TempLevel]
    : "var(--muted-foreground)"
}

export interface ClimaVeredaProperties {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano?: boolean
  /** Current temperature (°C) at the vereda centroid, or null if Open-Meteo returned nothing. */
  tempActual: number | null
  /** Apparent ("feels-like") temperature (°C), factoring wind, humidity and radiation. */
  sensacionTermica: number | null
  /** Current WMO weather code and its coarse group, or null. */
  weatherCodeActual: number | null
  grupoActual: WeatherGroup | null
  /** Whether it is currently daytime at the point — drives the clear-sky day/night glyph. */
  esDia: boolean
  tempMaxHoy: number | null
  tempMinHoy: number | null
  /** Temperature band from `tempActual`, used for the choropleth fill. */
  nivelTemp: TempLevel | null
  /** 7-day forecast, one entry per day. */
  dias: ClimaDay[]
  /** Consecutive dry days counted from day 0 of the forecast — a short drought outlook. */
  rachaSeca: number
}

export interface ClimaFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    id: string
    properties: ClimaVeredaProperties
    geometry: GeoJSON.Geometry
  }>
}

/** Headline current conditions per municipality, placed at its cabecera (casco urbano) centroid. */
export interface ClimaMunicipioResumen {
  municipio: string
  lat: number
  lon: number
  tempActual: number | null
  grupoActual: WeatherGroup | null
  esDia: boolean
  tempMax: number | null
  tempMin: number | null
}

export interface ClimaForecastResponse {
  generatedAt: string
  forecastDays: number
  municipios: ClimaMunicipioResumen[]
  veredas: ClimaFeatureCollection
}

export interface ClimaForecastErrorResponse {
  error: string
}

/** Shared month-label constant for the clima climatology charts (decadal-chart.tsx / quinquenal-chart.tsx). */
export const MONTH_LABELS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

/** A non-overlapping 10-year window, e.g. { inicio: 1994, fin: 2003 } — see lib/clima/openmeteo-decadal-climatology.ts. */
export interface TempDecadaBin {
  inicio: number
  fin: number
}

/** One month of /api/clima/climatologia-decadal. */
export interface TempDecadaMesPunto {
  month: number
  monthLabel: string
  /** This month's average daily-mean temperature (°C, Open-Meteo) across the years inside each 10-year bin, same order as `ClimaClimatologiaDecadalResponse.decadas`, or null if no bin had valid data. */
  decadas: Array<TempDecadaBin & { tempC: number | null }>
  /** This calendar year's average daily-mean temperature (°C, Open-Meteo) for this month, or null if the month hasn't started yet. */
  tempMeanActual: number | null
  /** This calendar year's average daily-maximum temperature (°C, Open-Meteo) for this month, or null. */
  tempMaxActual: number | null
  /** This calendar year's average daily-minimum temperature (°C, Open-Meteo) for this month, or null. */
  tempMinActual: number | null
  /** This calendar year's average apparent ("feels-like") maximum temperature (°C, Open-Meteo) for this month, or null. */
  sensacionActual: number | null
  /** True only for the current, still-in-progress month — the tempXActual fields are partial-month averages. */
  esMesEnCurso: boolean
  /** This month's average daily-mean temperature (°C, Open-Meteo) for each of the two calendar years just before the current one, same order as `ClimaClimatologiaDecadalResponse.aniosRecientes`. */
  reciente: Array<{ anio: number; tempC: number | null }>
}

export interface ClimaClimatologiaDecadalResponse {
  /** "vereda" for a single clicked vereda, "municipio" for an averaged whole-territory view. */
  scope: "vereda" | "municipio"
  ubicacion: {
    nombre: string
    municipio: string
    codigoVereda?: string
    veredasPromediadas?: number
  }
  generatedAt: string
  /** 1-12, this calendar year's current month. */
  mesEnCurso: number
  /** The 10-year bins plotted in `meses[].decadas`, oldest first. */
  decadas: TempDecadaBin[]
  /** The two individually-plotted recent years, most recent first. */
  aniosRecientes: number[]
  meses: TempDecadaMesPunto[]
}

export interface ClimaClimatologiaDecadalErrorResponse {
  error: string
}

/** A non-overlapping 5-year window, e.g. { inicio: 1999, fin: 2003 } — see lib/clima/openmeteo-quinquenal-climatology.ts. */
export interface TempQuinquenioBin {
  inicio: number
  fin: number
}

/** One month of /api/clima/climatologia-quinquenal. */
export interface TempQuinquenioMesPunto {
  month: number
  monthLabel: string
  /** This month's average daily-mean temperature (°C, Open-Meteo) across the years inside each 5-year bin, same order as `ClimaClimatologiaQuinquenalResponse.quinquenios`, or null if no bin had valid data. */
  quinquenios: Array<TempQuinquenioBin & { tempC: number | null }>
  tempMeanActual: number | null
  tempMaxActual: number | null
  tempMinActual: number | null
  sensacionActual: number | null
  esMesEnCurso: boolean
  reciente: Array<{ anio: number; tempC: number | null }>
}

export interface ClimaClimatologiaQuinquenalResponse {
  scope: "vereda" | "municipio"
  ubicacion: {
    nombre: string
    municipio: string
    codigoVereda?: string
    veredasPromediadas?: number
  }
  generatedAt: string
  mesEnCurso: number
  /** The 5-year bins plotted in `meses[].quinquenios`, oldest first. */
  quinquenios: TempQuinquenioBin[]
  aniosRecientes: number[]
  meses: TempQuinquenioMesPunto[]
}

export interface ClimaClimatologiaQuinquenalErrorResponse {
  error: string
}
