/** Client-safe response shapes for /api/inundaciones/susceptibilidad. No server imports. */

export interface FloodSusceptibilityFeatureProperties {
  descripcio: string
}

export interface FloodSusceptibilityFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: FloodSusceptibilityFeatureProperties
    geometry: GeoJSON.Geometry
  }>
}

export interface InundacionesSusceptibilidadResponse {
  generatedAt: string
  polygons: FloodSusceptibilityFeatureCollection
}

export interface InundacionesSusceptibilidadErrorResponse {
  error: string
}
