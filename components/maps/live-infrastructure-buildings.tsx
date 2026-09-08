"use client"

import { useMemo } from "react"
import { Building } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getOsmCategory, type OsmCategoryKey } from "@/lib/osm/categories"
import { pointsInBounds, type MapBounds } from "@/lib/map-bounds"
import type { OsmPoint } from "@/lib/osm/api-types"

interface LiveInfrastructureBuildingsProps {
  bounds: MapBounds | null
  points: OsmPoint[] | null
  activeCategories: Set<OsmCategoryKey>
  className?: string
}

/**
 * Names of the OpenStreetMap points of interest belonging to whichever
 * categories are toggled on in the adjacent `LiveInfrastructureCategories`
 * panel — the same toggle also turns on that category's markers on the
 * live map. Empty until at least one category is active, since listing
 * every business/office in the viewport by default would be noise, not
 * signal. Scrolls internally past a fixed height so it always matches the
 * categories panel next to it.
 */
export function LiveInfrastructureBuildings({
  bounds,
  points,
  activeCategories,
  className,
}: LiveInfrastructureBuildingsProps) {
  const grouped = useMemo(() => {
    if (!points || activeCategories.size === 0) return null
    const visible = bounds ? pointsInBounds(points, bounds) : points
    const byCategory = new Map<OsmCategoryKey, OsmPoint[]>()
    for (const point of visible) {
      if (!activeCategories.has(point.category)) continue
      const list = byCategory.get(point.category) ?? []
      list.push(point)
      byCategory.set(point.category, list)
    }
    for (const list of byCategory.values()) {
      list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    }
    return byCategory
  }, [points, bounds, activeCategories])

  return (
    <Card className={cn("flex h-[420px] max-h-[50vh] flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Building className="size-4" aria-hidden="true" />
          Edificaciones en el encuadre
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Nombres de las edificaciones de las categorías activas, dentro del encuadre actual del
          mapa.
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        {!grouped ? (
          <p className="text-sm text-muted-foreground">
            Activa una categoría en el panel de infraestructura para ver sus edificaciones aquí y
            en el mapa.
          </p>
        ) : grouped.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna edificación de las categorías activas está en el encuadre actual.
          </p>
        ) : (
          Array.from(grouped.entries()).map(([key, list]) => {
            const category = getOsmCategory(key)
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span
                    className={`size-2 shrink-0 rounded-full ${category.swatchClass}`}
                    aria-hidden="true"
                  />
                  {category.label} ({list.length})
                </p>
                <ul className="flex flex-col gap-1">
                  {list.map((point) => (
                    <li key={point.id} className="text-sm text-foreground">
                      {point.name ?? <span className="text-muted-foreground">Sin nombre</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
