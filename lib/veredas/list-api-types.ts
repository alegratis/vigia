/**
 * Client-safe types for /api/veredas/lista — a lightweight boundary index
 * (name, municipio, bbox, centroid) for the municipio → vereda picker in
 * the "Conoce tu nivel de exposición" popup. Deliberately separate from
 * VeredasResponse in lib/veredas/api-types.ts: that endpoint runs the full
 * hazard aggregation (point-in-polygon over ~11,800 points) the picker does
 * not need, just to populate two dropdowns and fit a map to a boundary.
 */

export interface VeredaListEntry {
  codigoVereda: string
  nombre: string
  municipio: string
  /** [south, west, north, east] in WGS84 degrees, used to fit the focused map to this vereda. */
  bbox: [number, number, number, number]
  /** [lat, lon] centroid of the bbox, for a fallback marker/center point. */
  center: [number, number]
  /** MultiPolygon coordinate rings ([lon, lat] order, GeoJSON convention) outlining the vereda, for drawing its exact boundary. */
  polygons: number[][][][]
}

export interface VeredaListResponse {
  generatedAt: string
  veredas: VeredaListEntry[]
}

export interface VeredaListErrorResponse {
  error: string
}
