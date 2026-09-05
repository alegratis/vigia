/** Client-safe response shapes for /api/deslizamientos. No server imports. */

export interface SusceptibilityFeatureProperties {
  municipio: string
  IS_nivel: string
}

export interface SusceptibilityFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: SusceptibilityFeatureProperties
    geometry: GeoJSON.Geometry
  }>
}

export interface PopulationByLevel {
  level: string
  total: number
  children: number
  elderly: number
}

export interface DeslizamientosResponse {
  generatedAt: string
  polygons: SusceptibilityFeatureCollection
  populationByLevel: PopulationByLevel[]
}

export interface DeslizamientosErrorResponse {
  error: string
}
