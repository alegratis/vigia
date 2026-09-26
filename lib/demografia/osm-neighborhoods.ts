import "server-only"

/**
 * Human-readable neighborhood ("barrio") names for DANE's manzana-level
 * geometry. DANE's manzana codes (`COD_DANE`/`COD_DANE_A`) are 18-digit
 * cadastral codes with no name of their own — illegible to a person
 * reading the map or a chart axis. This module queries OpenStreetMap's
 * public Overpass API once per study municipio for every named place
 * (barrio, urbanización, corregimiento, the town center itself, etc.)
 * inside that municipio's bounding box, then matches each manzana's
 * centroid to the nearest one by straight-line distance.
 *
 * Manzanas with nothing named nearby (rare — the edge of a poblado, a lone
 * industrial block) get `barrio: null`; callers must fall back to a
 * graceful, non-technical description instead of ever showing the raw
 * code (see e.g. `components/maps/demografia-live-map.tsx`'s popups).
 *
 * Best-effort enrichment only: Overpass is a free, best-effort public
 * service, so any failure here (timeout, rate limit) degrades to `null`
 * for every manzana in that municipio rather than failing the whole
 * Demografía tab.
 */

import centroid from "@turf/centroid"
import distance from "@turf/distance"
import { point } from "@turf/helpers"

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"
// Named places move even less often than census geometry — safe to cache as long as the manzana data itself.
const REVALIDATE_SECONDS = 2_592_000 // 30 days
// Beyond this, treat the manzana as having no named place nearby rather than mismatching it to a distant town.
const MAX_MATCH_DISTANCE_KM = 3

interface NamedPlace {
  name: string
  lat: number
  lon: number
}

interface OverpassElement {
  tags?: { name?: string }
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
}

interface Bbox {
  south: number
  west: number
  north: number
  east: number
}

/**
 * One Overpass query per municipio bounding box, run once and cached long.
 * Pulls every OSM `place` node/way a person would actually recognize —
 * barrios, urbanizaciones, corregimientos, hamlets, and the town center —
 * so every manzana in the urban core has *something* named nearby to match.
 */
async function fetchNamedPlaces(bbox: Bbox): Promise<NamedPlace[]> {
  const { south, west, north, east } = bbox
  const query = `[out:json][timeout:25];(node["place"~"^(suburb|neighbourhood|quarter|hamlet|village|town)$"](${south},${west},${north},${east});way["place"~"^(suburb|neighbourhood|quarter|hamlet|village|town)$"](${south},${west},${north},${east}););out center;`

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { elements: OverpassElement[] }
    const places: NamedPlace[] = []
    for (const el of json.elements) {
      const name = el.tags?.name
      const lat = el.lat ?? el.center?.lat
      const lon = el.lon ?? el.center?.lon
      if (name && lat != null && lon != null) places.push({ name, lat, lon })
    }
    return places
  } catch {
    return []
  }
}

/** Walks a GeoJSON coordinate array of any nesting depth to find its extent. */
function extendBbox(bbox: Bbox, coords: unknown): void {
  if (Array.isArray(coords) && typeof coords[0] === "number") {
    const [lon, lat] = coords as [number, number]
    if (lat < bbox.south) bbox.south = lat
    if (lat > bbox.north) bbox.north = lat
    if (lon < bbox.west) bbox.west = lon
    if (lon > bbox.east) bbox.east = lon
    return
  }
  if (Array.isArray(coords)) {
    for (const c of coords) extendBbox(bbox, c)
  }
}

function bboxOfFeatures(features: { geometry: GeoJSON.Geometry }[]): Bbox | null {
  const bbox: Bbox = { south: Infinity, west: Infinity, north: -Infinity, east: -Infinity }
  for (const f of features) {
    if ("coordinates" in f.geometry) extendBbox(bbox, f.geometry.coordinates)
  }
  if (!Number.isFinite(bbox.south)) return null
  // ~2km buffer so named places just outside the tightest manzana bbox still count.
  const pad = 0.02
  return { south: bbox.south - pad, west: bbox.west - pad, north: bbox.north + pad, east: bbox.east + pad }
}

/**
 * Attaches the nearest OSM place name to each feature's centroid, grouped
 * by `codigoMunicipio` so each municipio only needs one Overpass query no
 * matter how many manzanas it has. Returns a `codigoManzana → barrio name`
 * map; a manzana maps to `null` when nothing named was found within
 * `MAX_MATCH_DISTANCE_KM` (or Overpass was unreachable).
 */
export async function resolveBarrioNames<
  F extends { properties: { codigoManzana: string; codigoMunicipio: string }; geometry: GeoJSON.Geometry },
>(features: F[]): Promise<Map<string, string | null>> {
  const byMunicipio = new Map<string, F[]>()
  for (const f of features) {
    const list = byMunicipio.get(f.properties.codigoMunicipio) ?? []
    list.push(f)
    byMunicipio.set(f.properties.codigoMunicipio, list)
  }

  const entries = Array.from(byMunicipio.entries())
  const placesByMunicipio = await Promise.all(
    entries.map(([, feats]) => {
      const bbox = bboxOfFeatures(feats)
      return bbox ? fetchNamedPlaces(bbox) : Promise.resolve<NamedPlace[]>([])
    }),
  )

  const result = new Map<string, string | null>()
  entries.forEach(([, feats], i) => {
    const places = placesByMunicipio[i]
    for (const f of feats) {
      if (places.length === 0) {
        result.set(f.properties.codigoManzana, null)
        continue
      }
      const c = centroid(f.geometry as GeoJSON.GeoJSON)
      let best: { name: string; dist: number } | null = null
      for (const place of places) {
        const d = distance(c, point([place.lon, place.lat]), { units: "kilometers" })
        if (!best || d < best.dist) best = { name: place.name, dist: d }
      }
      result.set(f.properties.codigoManzana, best && best.dist <= MAX_MATCH_DISTANCE_KM ? best.name : null)
    }
  })

  return result
}
