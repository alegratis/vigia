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
  /** True when this day's forecast rainfall is under 1 mm — feeds the dry-spell fire adjustment. */
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
  /** Consecutive dry days counted from day 0 of the forecast. */
  rachaSeca: number
  /** Static structural fire-threat label from the incendios layer, or null (Zarzal has no coverage; unmatched veredas too). */
  amenazaIncendioBase: string | null
  /** Dry-spell-adjusted fire vulnerability, or null when there is no base label to adjust. */
  amenazaIncendioAjustada: string | null
  /** True when the current dry spell pushed the adjusted level above its base. */
  incendioElevado: boolean
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
