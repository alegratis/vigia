/**
 * Client-safe response shapes for /api/inundaciones/susceptibilidad and
 * /api/inundaciones/quebradas. No server imports.
 */

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

export interface QuebradaLineProperties {
  nombre: string
  /** "arcgis" for the 19 traces in streams.ts, "osm" for a supplemental trace like Quebrada San José. */
  source: "arcgis" | "osm"
  /** GEOGLOWS reach id, when the source layer carries one. Not used for lookups yet — see streams.ts. */
  rivid: number | null
}

export interface QuebradasFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: QuebradaLineProperties
    geometry: GeoJSON.MultiLineString
  }>
}

export interface InundacionesQuebradasResponse {
  generatedAt: string
  lines: QuebradasFeatureCollection
}

export interface InundacionesQuebradasErrorResponse {
  error: string
}
