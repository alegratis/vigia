/** Client-safe shapes for GET /api/geoglows/reaches — see lib/geoglows/reaches.ts. */

export interface GeoglowsReachProperties {
  /** GEOGLOWS / TDX-Hydro reach id. */
  comid: number
  /** Real river/creek name when the reach is one of the named traces in the Quebradas layer; null otherwise. */
  nombre: string | null
  /** Strahler stream order (2 = small tributary … 5 = main river). */
  streamorder: number
  /** Mean forecast flow, m³/s. */
  meanflow: number | null
  /** Return period (years) the current forecast exceeds: 0, 2, 10, 25 or 50. */
  returnperiod: number
  /** ISO timestamp of the forecast cycle. */
  forecastAt: string | null
}

export type GeoglowsReachFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString | GeoJSON.MultiLineString,
  GeoglowsReachProperties
>

export interface GeoglowsReachesResponse {
  generatedAt: string
  reaches: GeoglowsReachFeatureCollection
}

export interface GeoglowsReachesErrorResponse {
  error: string
}
