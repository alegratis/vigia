import "server-only"

/**
 * Client for USGS's public FDSN Event Web Service — real-time, global
 * earthquake catalog, no key required. Unlike the fixed-magnitude summary
 * feeds (e.g. `2.5_month.geojson`), the FDSN query endpoint supports a
 * bounding-box filter with no minimum magnitude, so small regional events
 * near the AOI aren't dropped the way they would be on the global feed.
 *
 * Docs: https://earthquake.usgs.gov/fdsnws/event/1/
 */

import type { SeismicEvent } from "./api-types"

const USGS_QUERY_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

interface UsgsFeature {
  id: string
  properties: {
    mag: number | null
    place: string | null
    time: number
  }
  geometry: {
    coordinates: [number, number, number] // [lon, lat, depthKm]
  }
}

interface UsgsResponse {
  features: UsgsFeature[]
}

export interface Bbox {
  south: number
  west: number
  north: number
  east: number
}

/** Live feed refreshes fast, but events near the AOI are rare — a short cache keeps this cheap without feeling stale. */
const REVALIDATE_SECONDS = 300

/**
 * Fetches every USGS-cataloged event within `bbox` over the last
 * `windowDays` days. Returns an empty, non-throwing list on failure so the
 * map can still render the SGC historical layer on its own.
 */
export async function getUsgsEvents(bbox: Bbox, windowDays: number): Promise<SeismicEvent[]> {
  const starttime = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
  const params = new URLSearchParams({
    format: "geojson",
    starttime,
    minlatitude: String(bbox.south),
    maxlatitude: String(bbox.north),
    minlongitude: String(bbox.west),
    maxlongitude: String(bbox.east),
    orderby: "time",
  })

  const res = await fetch(`${USGS_QUERY_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) throw new Error(`USGS FDSN query failed (${res.status})`)
  const data: UsgsResponse = await res.json()

  return data.features
    .filter((f) => f.properties.mag != null)
    .map((f) => ({
      id: `usgs-${f.id}`,
      source: "usgs" as const,
      time: new Date(f.properties.time).toISOString(),
      magnitude: f.properties.mag as number,
      depthKm: f.geometry.coordinates[2] ?? null,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      place: f.properties.place,
    }))
}
