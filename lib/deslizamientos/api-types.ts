/** Client-safe response shapes for /api/deslizamientos. No server imports. */

export interface SusceptibilityFeatureProperties {
  municipio: string
  /** Already normalized to the title-case SusceptibilityLevel scheme. */
  IS_nivel: string
}

/** Point geometry — see lib/deslizamientos/client.ts for why polygons aren't used for the map visual. */
export interface SusceptibilityFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: SusceptibilityFeatureProperties
    geometry: GeoJSON.Point
  }>
}

export interface PopulationByLevel {
  level: string
  total: number
  children: number
  elderly: number
}

/** Critical-infrastructure exposure counts summed by threat level, from the polygon layer's attributes. */
export interface ExposureByLevel {
  level: string
  schools: number
  hospitals: number
  pharmacies: number
  criticalInfra: number
}

export interface DeslizamientosResponse {
  generatedAt: string
  points: SusceptibilityFeatureCollection
  populationByLevel: PopulationByLevel[]
  exposureByLevel: ExposureByLevel[]
}

export interface DeslizamientosErrorResponse {
  error: string
}
