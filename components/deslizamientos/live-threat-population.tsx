"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Mountain } from "lucide-react"
import { cn } from "cn"
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

interface LiveThreatPopulationProps {
  className?: string
  /** Set when a point was just clicked on the map — narrows the filter to that level. */
  selectedLevel?: SusceptibilityLevel | null
  onClearSelection?: () => void
}

/**
 * Population and critical-infrastructure exposure to landslide
 * susceptibility, by threat level, from RED LabOT's `VIGIA_Amenaza_IS_*`
 * index. Figures are rounded to whole units for display.
 */
export function LiveThreatPopulation({
  className,
  selectedLevel,
  onClearSelection,
}: LiveThreatPopulationProps) {
  const { data, isLoading } = useSWR<DeslizamientosResponse>("/api/deslizamientos", fetcher, {
    revalidateOnFocus: false,
  })

  const [selectedLevels, setSelectedLevels] = useState<SusceptibilityLevel[]>([])

  useEffect(() => {
    if (selectedLevel) {
      setSelectedLevels([selectedLevel])
    }
  }, [selectedLevel])

  if (isLoading || !data) {
    return <Skeleton className={cn("h-[560px] rounded-xl", className)} />
  }

  const rows = data.populationByLevel
  const exposureByLevel = new Map(data.exposureByLevel.map((r) => [r.level, r]))
  const visible =
    selectedLevels.length === 0 ? rows : rows.filter((r) => selectedLevels.includes(r.level as SusceptibilityLevel))
  const visibleLevels = new Set(visible.map((r) => r.level))

  const totals = visible.reduce(
    (acc, r) => {
      const exposure = exposureByLevel.get(r.level)
      return {
        total: acc.total + r.total,
        children: acc.children + r.children,
        elderly: acc.elderly + r.elderly,
        schools: acc.schools + (exposure?.schools ?? 0),
        hospitals: acc.hospitals + (exposure?.hospitals ?? 0),
        pharmacies: acc.pharmacies + (exposure?.pharmacies ?? 0),
        criticalInfra: acc.criticalInfra + (exposure?.criticalInfra ?? 0),
      }
    },
    { total: 0, children: 0, elderly: 0, schools: 0, hospitals: 0, pharmacies: 0, criticalInfra: 0 },
  )

  return (
    <Card className={cn("flex h-[560px] flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Mountain className="size-4" aria-hidden="true" />
          Exposición en zona de susceptibilidad
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Población e infraestructura crítica del índice de susceptibilidad, por nivel de
          amenaza. Sin filtro, se suman los cinco niveles.
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        {selectedLevel && (
          <div className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-xs">
            <span className="text-foreground">
              Selección: <span className="font-medium">{selectedLevel}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedLevels([])
                onClearSelection?.()
              }}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Ver todo
            </button>
          </div>
        )}
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

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Infraestructura crítica</p>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Escuelas</span>
            <span className="font-medium tabular-nums">{formatNumber(Math.round(totals.schools))}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Hospitales</span>
            <span className="font-medium tabular-nums">{formatNumber(Math.round(totals.hospitals))}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Farmacias</span>
            <span className="font-medium tabular-nums">{formatNumber(Math.round(totals.pharmacies))}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Otra infraestructura crítica</span>
            <span className="font-medium tabular-nums">{formatNumber(Math.round(totals.criticalInfra))}</span>
          </div>
        </div>

        <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
          {rows.map((r) => {
            const style = SUSCEPTIBILITY_LEVEL_STYLES[r.level as SusceptibilityLevel]
            const dimmed = selectedLevels.length > 0 && !visibleLevels.has(r.level)
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
