import { classifyOsmTags, type OsmCategoryKey } from "./categories"
import type { OsmPoint } from "./api-types"

export interface OverpassElement {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  /** Present when the query uses `out geom` on a way — its full vertex list, e.g. for road-proximity.ts. */
  geometry?: Array<{ lat: number; lon: number }>
  tags?: Record<string, string>
}

/**
 * Classifies raw OSM elements (from Overpass or from a Geofabrik extract) into
 * the app's five infrastructure categories. Ways and relations resolve to a
 * single centroid; elements matching none of the categories are dropped.
 * No server imports, so scripts can reuse it too.
 */
export function elementsToPoints(elements: OverpassElement[]): OsmPoint[] {
  const points: OsmPoint[] = []
  for (const el of elements) {
    const tags = el.tags
    if (!tags) continue
    const category: OsmCategoryKey | null = classifyOsmTags(tags)
    if (!category) continue
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat == null || lon == null) continue
    points.push({
      id: `${el.type}/${el.id}`,
      lat,
      lon,
      category,
      name: tags.name ?? null,
    })
  }
  return points
}
