"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Building2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { OSM_CATEGORIES } from "@/lib/osm/categories"
import { pointsInBounds, type MapBounds } from "@/lib/map-bounds"
import { formatNumber } from "@/lib/demografia/ui"
import type { OsmInfrastructureResponse } from "@/lib/osm/api-types"

const fetcher = async (url: string): Promise<OsmInfrastructureResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la infraestructura de OpenStreetMap")
  return res.json()
}

interface LiveInfrastructureCategoriesProps {
  bounds: MapBounds | null
  className?: string
}

/**
 * Commercial and institutional buildings from OpenStreetMap (via the
 * Overpass API), tallied by category — salud, financiero, gobierno, social
 * y comercio — within the current map viewport. Fetches the whole study
 * area once (lib/osm/overpass.ts caches it server-side for 6h) and filters
 * client-side against `bounds`, the same viewport-scoping mechanism already
 * driving the population panels.
 */
export function LiveInfrastructureCategories({ bounds, className }: LiveInfrastructureCategoriesProps) {
  const { data, error, isLoading } = useSWR<OsmInfrastructureResponse>(
    "/api/osm/infraestructura",
    fetcher,
    { revalidateOnFocus: false },
  )

  const counts = useMemo(() => {
    if (!data) return null
    const visible = bounds ? pointsInBounds(data.points, bounds) : data.points
    const byCategory = new Map<string, number>()
    for (const point of visible) {
      byCategory.set(point.category, (byCategory.get(point.category) ?? 0) + 1)
    }
    return { visible, byCategory }
  }, [data, bounds])

  if (isLoading) {
    return <Skeleton className={`h-56 rounded-xl ${className ?? ""}`} />
  }

  if (error || !counts) {
    return (
      <Card className={className}>
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
    <Card className={className}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Building2 className="size-4" aria-hidden="true" />
          Infraestructura por categoría
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Edificaciones comerciales e institucionales de OpenStreetMap en el encuadre actual del
          mapa.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total en el encuadre</span>
          <span className="text-lg font-semibold tabular-nums">{formatNumber(total)}</span>
        </div>
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
          {OSM_CATEGORIES.map((category) => (
            <li key={category.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-foreground">
                <span className={`size-2.5 rounded-full ${category.swatchClass}`} aria-hidden="true" />
                {category.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(counts.byCategory.get(category.key) ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
