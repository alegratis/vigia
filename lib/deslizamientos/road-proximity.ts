import "server-only"

/**
 * Road proximity — the second half of the self-computed hazard model's
 * static terrain-susceptibility factor (see hazard-model.ts) — from
 * OpenStreetMap's road network, fetched once for the whole AOI via the same
 * Overpass client (mirrors, headers, `out geom`-friendly types) already
 * used for the "Infraestructura por categoría" points in lib/osm/overpass.ts.
 * Road cuts destabilize slopes by removing lateral support, so distance to
 * the nearest road is one of the five static predictors in NASA's LHASA v1
 * global susceptibility map (Stanley & Kirschbaum, 2017).
 */

import { queryOverpass, AOI_BBOX } from "@/lib/osm/overpass"

const ROAD_QUERY = `
  [out:json][timeout:25];
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|track|path)$"](${AOI_BBOX});
  out geom;
`.trim()

/**
 * Fetches every road-way vertex in the AOI (not just endpoints) — the
 * shared Overpass client already caches this for 6 hours.
 */
export async function getRoadVertices(): Promise<Array<{ lat: number; lon: number }>> {
  const json = await queryOverpass(ROAD_QUERY)
  const vertices: Array<{ lat: number; lon: number }> = []
  for (const el of json.elements) {
    if (el.geometry) vertices.push(...el.geometry)
  }
  return vertices
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Nearest-vertex distance (km) from a point to the road network — an
 * approximation of true point-to-line distance, but road ways in OSM carry
 * vertices dense enough (tens of meters apart) that the error is
 * negligible at the ~1 km influence radius this model uses (see
 * hazard-model.ts). Avoids pulling in a point-to-line-distance dependency
 * for a difference that wouldn't change any vereda's hazard level.
 */
export function nearestRoadDistanceKm(
  lat: number,
  lon: number,
  vertices: readonly { lat: number; lon: number }[],
): number | null {
  if (vertices.length === 0) return null
  let min = Infinity
  for (const v of vertices) {
    const d = haversineKm(lat, lon, v.lat, v.lon)
    if (d < min) min = d
  }
  return min
}
