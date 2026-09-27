/** Client-safe response shapes for /api/barrios. No server imports. */

export interface BarrioProperties {
  id: string
  nombre: string
  municipio: string
  estado: string | null
  frecuenciaInundacion: string | null
  frecuenciaMovimientoMasa: string | null
}

export interface BarrioFeature {
  type: "Feature"
  properties: BarrioProperties
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

export interface BarriosFeatureCollection {
  type: "FeatureCollection"
  features: BarrioFeature[]
}

export interface BarriosResponse {
  generatedAt: string
  barrios: BarriosFeatureCollection
  source: string
  sourceUrl: string
}

export interface BarriosErrorResponse {
  error: string
}
