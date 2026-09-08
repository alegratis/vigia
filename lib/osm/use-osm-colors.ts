"use client"

import { useEffect, useState } from "react"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { OSM_CATEGORIES, type OsmCategoryKey } from "./categories"

/**
 * Resolves each OSM category's CSS color token to a computed color string,
 * for surfaces that can't use Tailwind classes directly — Leaflet's
 * CircleMarker `pathOptions`. Same resolve-on-mount pattern already used
 * for the susceptibility/threat-level legends on each live map.
 */
export function useOsmCategoryColors(): Record<OsmCategoryKey, string> | null {
  const [colors, setColors] = useState<Record<OsmCategoryKey, string> | null>(null)

  useEffect(() => {
    const entries = OSM_CATEGORIES.map((c) => [c.key, resolveCssColor(c.colorToken)] as const)
    setColors(Object.fromEntries(entries) as Record<OsmCategoryKey, string>)
  }, [])

  return colors
}
