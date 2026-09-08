"use client"

import { useMemo } from "react"
import { getOsmCategory, type OsmCategoryKey } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import type { OsmPoint } from "@/lib/osm/api-types"

/**
 * On-map legend for the OpenStreetMap infrastructure markers. The category
 * toggles themselves live in the homepage sidebar, off-map, so this reads
 * directly off whichever points were actually passed to the map (already
 * filtered to the active categories upstream) rather than a static
 * five-category list — it only ever names colors that are actually on
 * screen, and disappears entirely when no category is toggled on.
 */
export function OsmLegend({ points }: { points: OsmPoint[] }) {
  const colors = useOsmCategoryColors()

  const activeKeys = useMemo(() => {
    const keys = new Set<OsmCategoryKey>()
    for (const point of points) keys.add(point.category)
    return Array.from(keys)
  }, [points])

  if (activeKeys.length === 0) return null

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Infraestructura (OpenStreetMap)</p>
      <ul className="flex flex-col gap-1">
        {activeKeys.map((key) => {
          const category = getOsmCategory(key)
          return (
            <li key={key} className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full border border-white/60"
                style={{ backgroundColor: colors?.[key] ?? "transparent" }}
                aria-hidden="true"
              />
              {category.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
