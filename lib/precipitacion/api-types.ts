/** Client-safe response shapes for /api/precipitacion/amenaza. No server imports. */

export type PrecipitacionMode = "historico" | "pronostico"

/** Historical-only: which data source backs the accumulation. Ignored (and irrelevant) in "pronostico" mode. */
export type PrecipitacionFuente = "power" | "ideam"

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
   * `windowDays` from NASA POWER (settled reanalysis days) or IDEAM
   * (summed 10-min station readings), depending on `fuente`. Forecast
   * mode: summed forecast precipitation (mm) over the next `windowDays`
   * days from Open-Meteo. `null` if the source had no valid data for this
   * vereda (for `fuente: "ideam"`, this includes veredas outside every
   * station's coverage radius — see `sinCobertura`).
   */
  acumuladoMm: number | null
  /** Number of valid days behind acumuladoMm — normally equal to windowDays; lower near a data gap. */
  diasValidos: number
  /** Forecast mode only: max daily precipitation probability (%) across the forecast window. */
  probabilidadMax?: number
  /** fuente: "ideam" only: name of the nearest station whose reading was used. */
  estacionNombre?: string
  /** fuente: "ideam" only: distance (km) from the vereda centroid to that station. */
  distanciaEstacionKm?: number
  /** fuente: "ideam" only: true when no station falls within the coverage radius — `acumuladoMm` is null because of sparse coverage, not a fetch error. */
  sinCobertura?: boolean
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
  /** "historico" (backward-looking) or "pronostico" (Open-Meteo, forward-looking). */
  mode: PrecipitacionMode
  /** Historical-only source used: "power" (NASA POWER) or "ideam" (station network). Always "power" in "pronostico" mode. */
  fuente: PrecipitacionFuente
  /** Number of days in the accumulation or forecast window. */
  windowDays: number
  /** End date (YYYY-MM-DD) of each vereda's accumulation window (historico) or the date the forecast was generated (pronostico). */
  windowEnd: string
  veredas: PrecipitacionFeatureCollection
}

export interface PrecipitacionAmenazaErrorResponse {
  error: string
}

/** One month of /api/precipitacion/climatologia — see lib/precipitacion/ideam-climatology.ts. */
export interface ClimatologiaMesPunto {
  month: number
  monthLabel: string
  /** Midpoint estimate (mm) of IDEAM's 1991-2020 normal band for this month, or null if unavailable at this point. */
  mm1991_2020: number | null
  /** The original published range, e.g. "150 - 200 mm". */
  rango1991_2020: string | null
  /** Midpoint estimate (mm) of IDEAM's 1981-2010 normal band for this month, or null if unavailable at this point. */
  mm1981_2010: number | null
  rango1981_2010: string | null
}

export interface ClimatologiaResponse {
  vereda: { codigoVereda: string; nombre: string; municipio: string }
  generatedAt: string
  meses: ClimatologiaMesPunto[]
}

export interface ClimatologiaErrorResponse {
  error: string
}
