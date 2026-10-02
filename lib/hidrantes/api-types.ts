/**
 * Shape of the Sevilla casco-urbano fire-hydrant layer, served as a static
 * GeoJSON file from `public/data/hidrantes/hidrantes-sevilla.geojson` (see
 * that file's header comment for how to replace the placeholder data with
 * the real inventory).
 */
export interface HidranteProperties {
  id?: string | number
  nombre?: string
  direccion?: string
  /** e.g. "Columna de incendio", "Hidrante de arqueta" — free text, whatever the source data uses. */
  tipo?: string
  caudal?: string
  estado?: string
  /** `true` on every point in the shipped sample file — absent once real data replaces it. */
  muestra?: boolean
  [key: string]: unknown
}

export interface HidranteFeature {
  type: "Feature"
  properties: HidranteProperties
  geometry: { type: "Point"; coordinates: [number, number] }
}

export interface HidrantesGeoJson {
  type: "FeatureCollection"
  features: HidranteFeature[]
}

/** A point used as the reference for "closest hydrant": the user's geolocation or a map click. */
export interface ReferencePoint {
  lat: number
  lon: number
  /** `true` when sourced from `navigator.geolocation`, `false` when the user clicked the map instead. */
  fromGeolocation: boolean
}

export interface HidranteRoute {
  geometry: GeoJSON.LineString
  distanceM: number
  durationS: number
  /** `false` when OSRM couldn't be reached and the line is just a straight fallback instead of a street route. */
  followsStreets: boolean
}
