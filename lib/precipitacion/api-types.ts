/** Client-safe response shapes for /api/precipitacion/amenaza. No server imports. */

export type PrecipitacionMode = "historico" | "pronostico"

/** Historical accumulation window options (days), shared by the UI and lib/precipitacion/power-client.ts. */
export const ACCUMULATION_WINDOW_OPTIONS = [7, 14, 30] as const
export type AccumulationWindowDays = (typeof ACCUMULATION_WINDOW_OPTIONS)[number]

/** Forecast window options (days), shared by the UI and lib/precipitacion/forecast-client.ts. */
export const FORECAST_WINDOW_OPTIONS = [7, 14] as const
export type ForecastWindowDays = (typeof FORECAST_WINDOW_OPTIONS)[number]

export interface PrecipitacionFeatureProperties {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano?: boolean
  /**
   * Historical mode: accumulated rainfall (mm) over the most recent
   * `windowDays` settled days available from NASA POWER. Forecast mode:
   * summed forecast precipitation (mm) over the next `windowDays` days
   * from Open-Meteo. `null` if the source had no valid data.
   */
  acumuladoMm: number | null
  /** Number of valid days behind acumuladoMm — normally equal to windowDays; lower near a data gap. */
  diasValidos: number
  /** Forecast mode only: max daily precipitation probability (%) across the forecast window. */
  probabilidadMax?: number
  nivel: string | null
}

export interface PrecipitacionFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    id: string
    properties: PrecipitacionFeatureProperties
    geometry: GeoJSON.Geometry
  }>
}

export interface PrecipitacionAmenazaResponse {
  generatedAt: string
  /** "historico" (NASA POWER, backward-looking) or "pronostico" (Open-Meteo, forward-looking). */
  mode: PrecipitacionMode
  /** Number of days in the accumulation or forecast window. */
  windowDays: number
  /** End date (YYYY-MM-DD) of each vereda's accumulation window (historico) or the date the forecast was generated (pronostico). */
  windowEnd: string
  veredas: PrecipitacionFeatureCollection
}

export interface PrecipitacionAmenazaErrorResponse {
  error: string
}
