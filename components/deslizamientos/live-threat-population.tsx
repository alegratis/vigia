"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Mountain } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { LevelFilters } from "@/components/deslizamientos/level-filters"
import { SUSCEPTIBILITY_LEVEL_STYLES, type SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import { formatNumber, formatShare } from "@/lib/demografia/ui"
import type { DeslizamientosResponse } from "@/lib/deslizamientos/api-types"

const fetcher = async (url: string): Promise<DeslizamientosResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la población por nivel de amenaza")
  return res.json()
}

/**
 * Population exposed to landslide susceptibility, by threat level. The
 * source grid is a density interpolation rather than a census count, so
 * figures are rounded to whole people for display but will not be exact
 * multiples — consistent with how the map presents estimated, not counted,
 * exposure.
 */
export function LiveThreatPopulation({ className }: { className?: string }) {
  const { data, isLoading } = useSWR<DeslizamientosResponse>("/api/deslizamientos", fetcher, {
    revalidateOnFocus: false,
  })

  const [selectedLevels, setSelectedLevels] = useState<SusceptibilityLevel[]>([])

  if (isLoading || !data) {
    return <Skeleton className={`h-64 rounded-xl ${className ?? ""}`} />
  }

  const rows = data.populationByLevel
  const visible =
    selectedLevels.length === 0 ? rows : rows.filter((r) => selectedLevels.includes(r.level as SusceptibilityLevel))

  const totals = visible.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      children: acc.children + r.children,
      elderly: acc.elderly + r.elderly,
    }),
    { total: 0, children: 0, elderly: 0 },
  )

  return (
    <Card className={className}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Mountain className="size-4" aria-hidden="true" />
          Población en zona de susceptibilidad
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Estimada a partir de la grilla de densidad poblacional cruzada con la capa de
          susceptibilidad. Sin filtro, se suman los cinco niveles.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        <LevelFilters selectedLevels={selectedLevels} onSelectedLevelsChange={setSelectedLevels} />

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Población estimada</span>
            <span className="text-lg font-semibold tabular-nums">{formatNumber(Math.round(totals.total))}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Menores de 5 años</span>
            <span className="font-medium tabular-nums">
              {formatNumber(Math.round(totals.children))} ({formatShare(totals.children, totals.total)})
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Mayores de 60 años</span>
            <span className="font-medium tabular-nums">
              {formatNumber(Math.round(totals.elderly))} ({formatShare(totals.elderly, totals.total)})
            </span>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
          {rows.map((r) => {
            const style = SUSCEPTIBILITY_LEVEL_STYLES[r.level as SusceptibilityLevel]
            const dimmed = selectedLevels.length > 0 && !selectedLevels.includes(r.level as SusceptibilityLevel)
            return (
              <li
                key={r.level}
                className={`flex items-center justify-between text-sm ${dimmed ? "opacity-40" : ""}`}
              >
                <span className="flex items-center gap-1.5 text-foreground">
                  <span className={`size-2.5 rounded-full ${style?.swatchClass ?? ""}`} aria-hidden="true" />
                  {r.level}
                </span>
                <span className="tabular-nums text-muted-foreground">{formatNumber(Math.round(r.total))}</span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
