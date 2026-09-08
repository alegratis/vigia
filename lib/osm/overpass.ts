import "server-only"

/**
 * Client for OpenStreetMap's public Overpass API — an open, no-auth data
 * source for the commercial/institutional buildings shown as the
 * "Infraestructura por categoría" breakdown alongside each hazard's
 * demographics panel, same open-data pattern as the ArcGIS/GWIS/GIBS
 * sources already in use elsewhere in the app.
 *
 * The whole study-area AOI is queried once here and cached for 6 hours —
 * never re-queried per map pan/zoom, since Overpass's public instance is
 * shared and rate-limited. Viewport filtering happens client-side instead
 * (lib/map-bounds.ts's `pointsInBounds`, against this same cached list).
 *
 * Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 */

import { classifyOsmTags, type OsmCategoryKey } from "./categories"
import type { OsmPoint } from "./api-types"

/**
 * Overpass's main instance occasionally resets the TLS connection under
 * load (a known flakiness with that public endpoint, unrelated to query
 * correctness). Fall through to its two most common community mirrors —
 * same public, no-auth API — before giving up.
 */
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
]

/** Same AOI bounding box the live hazard maps fit to: south,west,north,east. */
const AOI_BBOX = "3.88,-76.06,4.44,-75.72"

const HEALTH_AMENITIES = [
  "hospital",
  "clinic",
  "doctors",
  "dentist",
  "pharmacy",
  "veterinary",
]
const FINANCIAL_AMENITIES = ["bank", "bureau_de_change", "atm"]
const GOVERNMENT_AMENITIES = [
  "townhall",
  "courthouse",
  "police",
  "fire_station",
  "post_office",
  "embassy",
]
const SOCIAL_AMENITIES = ["social_facility", "community_centre", "place_of_worship", "library"]
const BUSINESS_AMENITIES = [
  "restaurant",
  "cafe",
  "fast_food",
  "bar",
  "pub",
  "fuel",
  "marketplace",
  "cinema",
  "theatre",
  "nightclub",
  "car_wash",
  "car_rental",
  "driving_school",
]

const AMENITY_VALUES = [
  ...HEALTH_AMENITIES,
  ...FINANCIAL_AMENITIES,
  ...GOVERNMENT_AMENITIES,
  ...SOCIAL_AMENITIES,
  ...BUSINESS_AMENITIES,
].join("|")

function buildQuery(): string {
  return `
    [out:json][timeout:25];
    (
      nwr["shop"](${AOI_BBOX});
      nwr["office"](${AOI_BBOX});
      nwr["craft"](${AOI_BBOX});
      nwr["amenity"~"^(${AMENITY_VALUES})$"](${AOI_BBOX});
      nwr["healthcare"](${AOI_BBOX});
    );
    out center tags;
  `.trim()
}

interface OverpassElement {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

/** Per-attempt timeout: a stalled TLS handshake shouldn't eat the whole
 * request budget before failing over to the next mirror. */
const MIRROR_TIMEOUT_MS = 7000

/**
 * Overpass's usage policy (and Apache-level content negotiation on some
 * mirrors) expects a descriptive `User-Agent` and an explicit `Accept` —
 * requests without them have been observed getting a blanket `406 Not
 * Acceptable` before the query is even evaluated, which otherwise looks
 * identical to a rate-limit or outage from the caller's side.
 */
const REQUEST_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
  "User-Agent": "VIGIA-RiskDashboard/1.0 (+https://vigia.vercel.app)",
}

async function queryOverpassMirror(
  url: string,
  query: string,
  controller: AbortController,
): Promise<OverpassResponse> {
  const timeout = setTimeout(() => controller.abort(), MIRROR_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: REQUEST_HEADERS,
      body: `data=${encodeURIComponent(query)}`,
      next: { revalidate: 21600 },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Overpass respondió ${res.status} desde ${url}`)
    }
    return (await res.json()) as OverpassResponse
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Overpass's public instances occasionally reset the TLS connection or
 * stall under load — transient flakiness, not a query problem. Races every
 * mirror concurrently (first success wins) instead of trying them one at a
 * time: a stalled handshake on one instance no longer blocks the others
 * behind it.
 *
 * The previous implementation tried mirrors sequentially across two full
 * passes, so a bad window could take up to MIRROR_TIMEOUT_MS × mirrors ×
 * passes (~48s) to fail over — comfortably past this route's serverless
 * function duration limit, which kills the invocation outright and
 * surfaces as an inconsistent, connection-dependent failure with no
 * useful error. Racing bounds the wait to a single timeout window
 * regardless of how many mirrors are struggling.
 */
async function queryOverpass(query: string): Promise<OverpassResponse> {
  const controllers = OVERPASS_URLS.map(() => new AbortController())
  const attempts = OVERPASS_URLS.map((url, i) => queryOverpassMirror(url, query, controllers[i]))
  try {
    const result = await Promise.any(attempts)
    // Stop the losing requests instead of letting them run to their own
    // timeout in the background.
    for (const controller of controllers) controller.abort()
    return result
  } catch (err) {
    const causes = err instanceof AggregateError ? err.errors : [err]
    const lastError = causes[causes.length - 1]
    throw lastError instanceof Error
      ? lastError
      : new Error("No se pudo consultar la API de Overpass (OpenStreetMap)")
  }
}

/**
 * Fetches and classifies every business/health/financial/government/social
 * point of interest in the study area. Ways and relations resolve to a
 * single centroid via Overpass's `out center` (no polygon geometry needed
 * for a point count). Elements matching none of the five categories are
 * dropped.
 */
export async function getInfrastructurePoints(): Promise<OsmPoint[]> {
  const json = await queryOverpass(buildQuery())

  const points: OsmPoint[] = []
  for (const el of json.elements) {
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
