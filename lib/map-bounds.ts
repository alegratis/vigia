/**
 * Shared geometry helpers for cross-referencing a Leaflet map viewport
 * (as exported by the qgis2web plugin) with the municipality reference
 * points used across the flood, fire and demographics modules.
 */

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export function isValidBounds(value: unknown): value is MapBounds {
  if (!value || typeof value !== "object") return false
  const b = value as Record<string, unknown>
  return (
    typeof b.north === "number" &&
    typeof b.south === "number" &&
    typeof b.east === "number" &&
    typeof b.west === "number" &&
    Number.isFinite(b.north) &&
    Number.isFinite(b.south) &&
    Number.isFinite(b.east) &&
    Number.isFinite(b.west)
  )
}

/** Filters reference points to those whose centroid falls within the bounds. */
export function pointsInBounds<T extends { lat: number; lon: number }>(
  points: readonly T[],
  bounds: MapBounds,
): T[] {
  return points.filter(
    (p) =>
      p.lat <= bounds.north &&
      p.lat >= bounds.south &&
      p.lon <= bounds.east &&
      p.lon >= bounds.west,
  )
}

/**
 * Finds whichever reference point is closest (by simple squared distance —
 * fine at this scale, no need for a true haversine) to a clicked lat/lng.
 * Used to resolve a municipio for hazard layers whose zone features don't
 * carry a municipio field of their own (e.g. the inundaciones
 * susceptibility zones, which only carry a `descripcio` level).
 */
export function nearestPoint<T extends { lat: number; lon: number }>(
  lat: number,
  lon: number,
  points: readonly T[],
): T | null {
  let best: T | null = null
  let bestDistance = Infinity
  for (const point of points) {
    const dLat = point.lat - lat
    const dLon = point.lon - lon
    const distance = dLat * dLat + dLon * dLon
    if (distance < bestDistance) {
      bestDistance = distance
      best = point
    }
  }
  return best
}

/** postMessage payload broadcast by the bridge snippet embedded in a qgis2web export. */
export interface MapBoundsMessage {
  type: "vigia:map-bounds"
  bounds: MapBounds
}
