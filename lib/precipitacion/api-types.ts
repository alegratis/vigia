/** Client-safe response shapes for /api/precipitacion/amenaza. No server imports. */

export interface PrecipitacionFeatureProperties {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano?: boolean
  /** Accumulated rainfall (mm) over the most recent 7 settled days available from NASA POWER, or `null` if the source had no valid data. */
  acumuladoMm: number | null
  /** Number of valid (non-fill-value) days behind acumuladoMm — normally 7; lower near a data gap. */
  diasValidos: number
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
  /** End date (YYYY-MM-DD) of each vereda's 7-day accumulation window. */
  windowEnd: string
  veredas: PrecipitacionFeatureCollection
}

export interface PrecipitacionAmenazaErrorResponse {
  error: string
}
