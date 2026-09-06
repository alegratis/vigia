/** Client-safe response shapes for /api/incendios/amenaza. No server imports. */

export interface FireThreatFeatureProperties {
  NOMB_MPIO: string
  NOMBRE_VER: string | null
  Amenaza_Label: string
}

export interface FireThreatFeatureCollection {
  type: "FeatureCollection"
  features: Array<{
    type: "Feature"
    properties: FireThreatFeatureProperties
    geometry: GeoJSON.Geometry
  }>
}

export interface IncendiosAmenazaResponse {
  generatedAt: string
  polygons: FireThreatFeatureCollection
}

export interface IncendiosAmenazaErrorResponse {
  error: string
}
