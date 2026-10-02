/**
 * Client-safe metadata for the "sitios sensibles" layer on the hidrantes
 * map — schools/universities, hospitals, and government/public buildings
 * near Sevilla's casco urbano, fetched once via scripts/fetch-sensitive-sites.mjs
 * and served statically from public/data/hidrantes/sitios-sensibles.geojson
 * (same static-data pattern as hidrantes-sevilla.geojson; this data changes
 * rarely enough that querying Overpass on every request isn't worth it).
 *
 * Hydrants within SENSITIVE_PROXIMITY_M of one of these sites get a tighter
 * coverage requirement (COVERAGE_RADIUS_TIGHT_M instead of the default
 * COVERAGE_RADIUS_DEFAULT_M) — see hidrantes-live-map.tsx.
 */

export type SensitiveSiteCategory = "educacion" | "salud" | "gobierno"

export interface SensitiveSiteStyle {
  key: SensitiveSiteCategory
  label: string
  /** Fill/outline color for the polygon or point marker on the map. */
  color: string
}

export const SENSITIVE_SITE_STYLES: readonly SensitiveSiteStyle[] = [
  { key: "educacion", label: "Institución educativa", color: "#2563eb" },
  { key: "salud", label: "Hospital", color: "#db2777" },
  { key: "gobierno", label: "Sede de gobierno", color: "#0891b2" },
]

const STYLE_BY_CATEGORY = new Map(SENSITIVE_SITE_STYLES.map((s) => [s.key, s] as const))

export function getSensitiveSiteStyle(category: string): SensitiveSiteStyle {
  return STYLE_BY_CATEGORY.get(category as SensitiveSiteCategory) ?? SENSITIVE_SITE_STYLES[0]
}

export interface SensitiveSiteFeature extends GeoJSON.Feature {
  properties: { category: SensitiveSiteCategory; name: string | null }
}

/** Any hydrant within this distance of a sensitive site gets the tighter coverage radius. */
export const SENSITIVE_PROXIMITY_M = 150
