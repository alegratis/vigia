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

/** postMessage payload broadcast by the bridge snippet embedded in a qgis2web export. */
export interface MapBoundsMessage {
  type: "vigia:map-bounds"
  bounds: MapBounds
}
