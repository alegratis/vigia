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
const MIRROR_TIMEOUT_MS = 8000

async function queryOverpassMirror(url: string, query: string): Promise<OverpassResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MIRROR_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
 * stall under load — transient flakiness, not a query problem. Tries every
 * mirror with a short per-attempt timeout, then makes one more full pass
 * across all mirrors before giving up, since a bad network window on one
 * pass often clears by the second.
 */
async function queryOverpass(query: string): Promise<OverpassResponse> {
  let lastError: unknown
  for (let pass = 0; pass < 2; pass++) {
    for (const url of OVERPASS_URLS) {
      try {
        return await queryOverpassMirror(url, query)
      } catch (err) {
        // Try the next mirror (or, on the final mirror of a pass, the next
        // pass) instead of failing the whole request on one bad attempt.
        lastError = err
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo consultar la API de Overpass (OpenStreetMap)")
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
