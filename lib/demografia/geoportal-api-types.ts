/** Client-safe response shapes for /api/demografia-geoportal. No server imports. */

export interface PobrezaFeatureProperties {
  municipio: string
  codigoMunicipio: string
  /** % of households in multidimensional poverty (DANE IPM 2018). */
  ipm: number
}

export interface PobrezaFeature {
  type: "Feature"
  properties: PobrezaFeatureProperties
  geometry: GeoJSON.Geometry
}

export interface PobrezaFeatureCollection {
  type: "FeatureCollection"
  features: PobrezaFeature[]
}

export interface ManzanaFeatureProperties {
  codigoMunicipio: string
  codigoManzana: string
  viviendas: number
  hogares: number
  personas: number
}

export interface ManzanaFeature {
  type: "Feature"
  properties: ManzanaFeatureProperties
  geometry: GeoJSON.Geometry
}

export interface ManzanaFeatureCollection {
  type: "FeatureCollection"
  features: ManzanaFeature[]
}

export interface DemografiaGeoportalResponse {
  generatedAt: string
  pobreza: PobrezaFeatureCollection
  manzanas: ManzanaFeatureCollection
  source: string
  sourceUrl: string
}

export interface DemografiaGeoportalErrorResponse {
  error: string
}
