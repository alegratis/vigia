"use client"

import { useMemo } from "react"
import { Building2 } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { OSM_CATEGORIES, type OsmCategoryKey } from "@/lib/osm/categories"
import { pointsInBounds, type MapBounds } from "@/lib/map-bounds"
import { formatNumber } from "@/lib/demografia/ui"
import type { OsmPoint } from "@/lib/osm/api-types"

interface LiveInfrastructureCategoriesProps {
  bounds: MapBounds | null
  points: OsmPoint[] | null
  isLoading: boolean
  error: unknown
  activeCategories: Set<OsmCategoryKey>
  onToggleCategory: (key: OsmCategoryKey) => void
  className?: string
}

/**
 * Commercial and institutional buildings from OpenStreetMap (via the
 * Overpass API), tallied by category — salud, financiero, gobierno, social
 * y comercio — within the current map viewport. `points` comes from the
 * shared `useOsmInfrastructure` hook (also consumed by the building-name
 * list and the live map's markers) and is filtered here against `bounds`,
 * the same viewport-scoping mechanism already driving the population
 * panels.
 *
 * Each row's checkbox activates that category's building names in the
 * adjacent panel and its markers on the map — it does not affect the
 * counts shown here, which always reflect every category in the viewport.
 */
export function LiveInfrastructureCategories({
  bounds,
  points,
  isLoading,
  error,
  activeCategories,
  onToggleCategory,
  className,
}: LiveInfrastructureCategoriesProps) {
  const counts = useMemo(() => {
    if (!points) return null
    const visible = bounds ? pointsInBounds(points, bounds) : points
    const byCategory = new Map<string, number>()
    for (const point of visible) {
      byCategory.set(point.category, (byCategory.get(point.category) ?? 0) + 1)
    }
    return { visible, byCategory }
  }, [points, bounds])

  if (isLoading) {
    return <Skeleton className={cn("h-[420px] rounded-xl", className)} />
  }

  if (error || !counts) {
    return (
      <Card className={cn("flex h-[420px] flex-col", className)}>
        <CardHeader className="gap-1 border-b border-border">
          <h3 className="flex items-center gap-2 font-semibold tracking-tight">
            <Building2 className="size-4" aria-hidden="true" />
            Infraestructura por categoría
          </h3>
        </CardHeader>
        <CardContent className="py-4">
          <p className="text-sm text-destructive">No se pudo cargar la infraestructura de OpenStreetMap.</p>
        </CardContent>
      </Card>
    )
  }

  const total = counts.visible.length

  return (
    <Card className={cn("flex h-[420px] flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Building2 className="size-4" aria-hidden="true" />
          Infraestructura por categoría
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Edificaciones comerciales e institucionales de OpenStreetMap en el encuadre actual del
          mapa. Activa una categoría para ver sus nombres y marcarla en el mapa.
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total en el encuadre</span>
          <span className="text-lg font-semibold tabular-nums">{formatNumber(total)}</span>
        </div>
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
          {OSM_CATEGORIES.map((category) => {
            const checked = activeCategories.has(category.key)
            return (
              <li key={category.key}>
                <div
                  className="flex min-h-10 items-center gap-2 rounded-md border px-2.5 transition-colors"
                  style={
                    checked
                      ? {
                          borderColor: category.colorToken,
                          backgroundColor: `color-mix(in oklab, ${category.colorToken} 18%, transparent)`,
                        }
                      : { borderColor: "var(--border)" }
                  }
                >
                  <Checkbox
                    id={`osm-category-${category.key}`}
                    checked={checked}
                    onCheckedChange={() => onToggleCategory(category.key)}
                    aria-label={`Mostrar edificaciones de ${category.label} en el mapa`}
                  />
                  <Label
                    htmlFor={`osm-category-${category.key}`}
                    className="flex flex-1 items-center gap-1.5 text-sm font-medium"
                    style={{ color: checked ? "var(--foreground)" : "var(--muted-foreground)" }}
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${category.swatchClass}`}
                      aria-hidden="true"
                    />
                    {category.label}
                  </Label>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {formatNumber(counts.byCategory.get(category.key) ?? 0)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
