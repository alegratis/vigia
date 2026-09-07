/**
 * Shared, client-safe taxonomy for classifying OpenStreetMap points of
 * interest into the five commercial/institutional building categories shown
 * alongside each hazard's demographics panel: health, financial, government,
 * social and a business catch-all. No server imports — kept separate from
 * lib/osm/overpass.ts (the server-only Overpass client) so this file can be
 * imported by client components too.
 */

export type OsmCategoryKey = "health" | "financial" | "government" | "social" | "business"

export interface OsmCategory {
  key: OsmCategoryKey
  label: string
  /** Background utility class for swatches, e.g. legend dots and breakdown rows. */
  swatchClass: string
  /** Raw CSS color token, for surfaces that can't use Tailwind classes. */
  colorToken: string
}

export const OSM_CATEGORIES: readonly OsmCategory[] = [
  { key: "health", label: "Salud", swatchClass: "bg-osm-health", colorToken: "var(--osm-health)" },
  {
    key: "financial",
    label: "Financiero",
    swatchClass: "bg-osm-financial",
    colorToken: "var(--osm-financial)",
  },
  {
    key: "government",
    label: "Gobierno",
    swatchClass: "bg-osm-government",
    colorToken: "var(--osm-government)",
  },
  { key: "social", label: "Social", swatchClass: "bg-osm-social", colorToken: "var(--osm-social)" },
  {
    key: "business",
    label: "Comercio",
    swatchClass: "bg-osm-business",
    colorToken: "var(--osm-business)",
  },
]

const HEALTH_AMENITIES = new Set([
  "hospital",
  "clinic",
  "doctors",
  "dentist",
  "pharmacy",
  "veterinary",
])
const FINANCIAL_AMENITIES = new Set(["bank", "bureau_de_change", "atm"])
const GOVERNMENT_AMENITIES = new Set([
  "townhall",
  "courthouse",
  "police",
  "fire_station",
  "post_office",
  "embassy",
])
const SOCIAL_AMENITIES = new Set([
  "social_facility",
  "community_centre",
  "place_of_worship",
  "library",
])

/**
 * Maps a raw OSM tag set to one category, in priority order so a point
 * matching more than one rule (e.g. a `shop=pharmacy` that also carries
 * `healthcare=pharmacy`) never double-counts. Anything matching none of
 * these — a residential building, a bare `building=yes`, etc. — returns
 * `null` and is excluded upstream.
 */
export function classifyOsmTags(tags: Record<string, string>): OsmCategoryKey | null {
  const amenity = tags.amenity
  const office = tags.office
  const shop = tags.shop
  const craft = tags.craft

  if (tags.healthcare || (amenity && HEALTH_AMENITIES.has(amenity))) {
    return "health"
  }
  if ((amenity && FINANCIAL_AMENITIES.has(amenity)) || office === "financial") {
    return "financial"
  }
  if ((amenity && GOVERNMENT_AMENITIES.has(amenity)) || office === "government") {
    return "government"
  }
  if ((amenity && SOCIAL_AMENITIES.has(amenity)) || office === "ngo") {
    return "social"
  }
  // Catch-all: any remaining shop/office/craft, or a commercial amenity not
  // already claimed above (restaurant, cafe, fuel, marketplace, etc.).
  if (shop || office || craft || amenity) {
    return "business"
  }
  return null
}
