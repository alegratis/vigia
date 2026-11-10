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
import { withSnapshot } from "@/lib/upstream/resilient"

const ROAD_QUERY = `
  [out:json][timeout:25];
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|track|path)$"](${AOI_BBOX});
  out geom;
`.trim()

type RoadVertex = { lat: number; lon: number }

/**
 * Un vértice por celda de ~110 m. El modelo solo usa un radio de influencia de 1 km, así que el
 * error es irrelevante y la copia guardada baja de decenas de MB a ~1 MB. El mismo aligerado se
 * aplica en scripts/osm/extract-infrastructure.py, que carga esta copia desde el extracto de Geofabrik.
 */
const ROAD_CELL_DEGREES = 0.001

async function loadRoadVertices(): Promise<Array<[number, number]>> {
  const json = await queryOverpass(ROAD_QUERY)
  const cells = new Map<string, [number, number]>()
  for (const el of json.elements) {
    for (const v of el.geometry ?? []) {
      const key = `${Math.round(v.lat / ROAD_CELL_DEGREES)}:${Math.round(v.lon / ROAD_CELL_DEGREES)}`
      if (!cells.has(key)) cells.set(key, [Math.round(v.lat * 1e5) / 1e5, Math.round(v.lon * 1e5) / 1e5])
    }
  }
  return [...cells.values()]
}

const expanded = new WeakMap<object, RoadVertex[]>()

/**
 * Road-way vertices in the AOI. Overpass bloquea buena parte de la infraestructura de nube, y sin
 * esta capa el modelo calcularía la susceptibilidad sin el factor de vías, sin avisar. Por eso se
 * sirve la copia guardada (Supabase) y Overpass solo la renueva en segundo plano.
 */
export async function getRoadVertices(): Promise<RoadVertex[]> {
  const stored = await withSnapshot("osm:vias", loadRoadVertices, {
    ttlSeconds: 21_600,
    timeoutMs: 30_000,
    preferStored: true,
  })
  let vertices = expanded.get(stored)
  if (!vertices) {
    vertices = stored.map(([lat, lon]) => ({ lat, lon }))
    expanded.set(stored, vertices)
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
