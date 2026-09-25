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

/** A non-overlapping 5-year window, e.g. { inicio: 1999, fin: 2003 } — see lib/precipitacion/openmeteo-quinquenal-climatology.ts. */
export interface QuinquenioBin {
  inicio: number
  fin: number
}

/** One month of /api/precipitacion/climatologia-quinquenal. */
export interface QuinquenioMesPunto {
  month: number
  monthLabel: string
  /** This month's average monthly total (mm, Open-Meteo) across the years inside each 5-year bin, same order as `ClimatologiaQuinquenalResponse.quinquenios`, or null if no bin had valid data. */
  quinquenios: Array<QuinquenioBin & { mm: number | null }>
  /** This calendar year's actual accumulated rainfall (Open-Meteo) for this month, or null if the month hasn't started yet. */
  mmActual: number | null
  /** True only for the current, still-in-progress month — mmActual is a partial-month sum, not a full month. */
  esMesEnCurso: boolean
  /**
   * This month's full-month total (mm, Open-Meteo) for each of the two
   * calendar years just before the current one (e.g. [2025, 2024] when the
   * current year is 2026), same order as
   * `ClimatologiaQuinquenalResponse.aniosRecientes` — kept out of the
   * 5-year bins above so the most recent, still-relevant years are always
   * comparable individually rather than blended into an average.
   */
  reciente: Array<{ anio: number; mm: number | null }>
}

export interface ClimatologiaQuinquenalResponse {
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
  /** The 5-year bins plotted in `meses[].quinquenios`, oldest first — e.g. [{inicio:1999,fin:2003}, ..., {inicio:2019,fin:2023}]. */
  quinquenios: QuinquenioBin[]
  /** The two individually-plotted recent years, most recent first — e.g. [2025, 2024]. */
  aniosRecientes: number[]
  meses: QuinquenioMesPunto[]
}

export interface ClimatologiaQuinquenalErrorResponse {
  error: string
}

/** A non-overlapping 10-year window, e.g. { inicio: 1994, fin: 2003 } — see lib/precipitacion/openmeteo-decadal-climatology.ts. */
export interface DecadaBin {
  inicio: number
  fin: number
}

/** One month of /api/precipitacion/climatologia-decadal. */
export interface DecadaMesPunto {
  month: number
  monthLabel: string
  /** This month's average monthly total (mm, Open-Meteo) across the years inside each 10-year bin, same order as `ClimatologiaDecadalResponse.decadas`, or null if no bin had valid data. */
  decadas: Array<DecadaBin & { mm: number | null }>
  /** This calendar year's actual accumulated rainfall (Open-Meteo) for this month, or null if the month hasn't started yet. */
  mmActual: number | null
  /** True only for the current, still-in-progress month — mmActual is a partial-month sum, not a full month. */
  esMesEnCurso: boolean
  /**
   * This month's full-month total (mm, Open-Meteo) for each of the two
   * calendar years just before the current one (e.g. [2025, 2024] when the
   * current year is 2026), same order as
   * `ClimatologiaDecadalResponse.aniosRecientes` — kept out of the 10-year
   * bins above so the most recent, still-relevant years are always
   * comparable individually rather than blended into a decade average.
   */
  reciente: Array<{ anio: number; mm: number | null }>
}

export interface ClimatologiaDecadalResponse {
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
  /** The 10-year bins plotted in `meses[].decadas`, oldest first — e.g. [{inicio:1994,fin:2003}, {inicio:2004,fin:2013}, {inicio:2014,fin:2023}]. */
  decadas: DecadaBin[]
  /** The two individually-plotted recent years, most recent first — e.g. [2025, 2024]. */
  aniosRecientes: number[]
  meses: DecadaMesPunto[]
}

export interface ClimatologiaDecadalErrorResponse {
  error: string
}
