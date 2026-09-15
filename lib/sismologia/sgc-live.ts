import "server-only"

/**
 * Client for the Servicio Geológico Colombiano's Red Sismológica Nacional
 * (RSNC) near-real-time feed — the piece USGS's global catalog misses.
 * USGS only reliably lists Colombian events down to ~M4, so small local
 * tremors (M1–M4) near the AOI never appear on the live layer. This feed
 * publishes every RSNC-located event of the last few days, magnitudes from
 * ~M0.4 up, with a human-readable `place`, review status and depth.
 *
 * The feed follows the USGS GeoJSON "summary feed" shape but with two
 * important quirks handled below:
 *  - geometry coordinates are `[lat, lon, depth]`, NOT the GeoJSON-standard
 *    `[lon, lat, depth]`.
 *  - timestamps are space-separated `YYYY-MM-DD HH:mm` strings (`utcTime`
 *    in UTC), not ISO 8601.
 *
 * Earthquakes cannot be forecast; this improves live *detection* coverage,
 * not prediction. Returns an empty, non-throwing list on failure so the
 * map still renders its other layers.
 */

import type { SeismicEvent } from "./api-types"
import type { Bbox } from "./usgs"

const SGC_LIVE_URL = "https://archive.sgc.gov.co/feed/v1.0.1/summary/five_days_all.json"

/** Days of history the feed covers — surfaced in the UI. */
export const SGC_LIVE_WINDOW_DAYS = 5

interface SgcLiveFeature {
  id: string
  properties: {
    mag: number | null
    place: string | null
    magType: string | null
    /** "manual" (analyst-reviewed) or "automatic". */
    status: string | null
    /** UTC timestamp as "YYYY-MM-DD HH:mm". */
    utcTime: string | null
    type: string | null
  }
  geometry: {
    // Non-standard order: [lat, lon, depthKm].
    coordinates: [number, number, number]
  } | null
}

interface SgcLiveResponse {
  features: SgcLiveFeature[]
}

/** Live feed updates every few minutes; a short cache keeps it fresh without hammering SGC. */
const REVALIDATE_SECONDS = 300

/** Parses the feed's "YYYY-MM-DD HH:mm" UTC string into an ISO timestamp, or null if unparseable. */
function parseUtc(raw: string | null): string | null {
  if (!raw) return null
  const iso = `${raw.trim().replace(" ", "T")}:00Z`
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/**
 * Fetches every RSNC event within `bbox` from the near-real-time feed.
 * The feed is global (it also carries significant world events), so the
 * bbox filter keeps only events in/around the study region.
 */
export async function getSgcLiveEvents(bbox: Bbox): Promise<SeismicEvent[]> {
  const res = await fetch(SGC_LIVE_URL, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!res.ok) throw new Error(`SGC live feed failed (${res.status})`)
  const data: SgcLiveResponse = await res.json()

  const events: SeismicEvent[] = []
  for (const f of data.features) {
    const coords = f.geometry?.coordinates
    if (!coords || f.properties.mag == null) continue
    const [lat, lon, depthKm] = coords
    if (lat < bbox.south || lat > bbox.north || lon < bbox.west || lon > bbox.east) continue
    if (f.properties.type && f.properties.type !== "earthquake") continue

    const time = parseUtc(f.properties.utcTime)
    events.push({
      id: `sgc-live-${f.id}`,
      source: "sgc-live",
      time: time ?? new Date(0).toISOString(),
      magnitude: f.properties.mag,
      depthKm: typeof depthKm === "number" ? depthKm : null,
      lat,
      lon,
      place: f.properties.place,
      reviewStatus: f.properties.status === "manual" || f.properties.status === "automatic" ? f.properties.status : null,
    })
  }
  return events
}
