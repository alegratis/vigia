/**
 * Small, client-safe helpers for turning a region's framing bounds (or a
 * loose set of points) into the two bounding-box string formats the app's
 * open-data sources expect: OpenStreetMap Overpass (`south,west,north,east`)
 * and ArcGIS FeatureServer envelopes (`minLon,minLat,maxLon,maxLat`). Kept
 * in one place so every region-scoped query — OSM infrastructure, the
 * landslide model's road/fault/inventory inputs — derives its box the same
 * way from the selected municipio.
 */

/** `[[south, west], [north, east]]`, matching `Region.bounds`. */
export type Bounds = [[number, number], [number, number]]

/** Overpass QL bounding box: `south,west,north,east`. */
export function overpassBbox(bounds: Bounds): string {
  const [[south, west], [north, east]] = bounds
  return `${south},${west},${north},${east}`
}

/** ArcGIS `esriGeometryEnvelope` (WGS84): `minLon,minLat,maxLon,maxLat`. */
export function arcgisEnvelope(bounds: Bounds): string {
  const [[south, west], [north, east]] = bounds
  return `${west},${south},${east},${north}`
}

/**
 * Bounds enclosing a set of points with a degree margin (~0.05° ≈ 5 km) —
 * used by the landslide model to scope its road/fault/inventory queries to
 * whatever municipio's vereda centroids it's scoring.
 */
export function boundsFromPoints(
  points: readonly { lat: number; lon: number }[],
  marginDeg = 0.05,
): Bounds {
  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  return [
    [Math.min(...lats) - marginDeg, Math.min(...lons) - marginDeg],
    [Math.max(...lats) + marginDeg, Math.max(...lons) + marginDeg],
  ]
}
