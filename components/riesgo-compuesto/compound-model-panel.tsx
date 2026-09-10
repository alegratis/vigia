"use client"

import { useMemo } from "react"
import { ShieldAlert, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useCompoundVeredas } from "@/lib/riesgo-compuesto/use-compound-veredas"
import { COMPOUND_LEVELS, COMPOUND_LEVEL_STYLES, type CompoundLevel } from "@/lib/riesgo-compuesto/levels"
import type { CompoundFeature, CompoundFeatureCollection } from "@/lib/riesgo-compuesto/api-types"

interface MunicipioSummary {
  municipio: string
  totalVeredas: number
  veredasConDatos: number
  levelCounts: Record<CompoundLevel, number>
}

function summarizeByMunicipio(veredas: CompoundFeatureCollection): MunicipioSummary[] {
  const byMunicipio = new Map<string, CompoundFeature[]>()
  for (const feature of veredas.features) {
    const list = byMunicipio.get(feature.properties.municipio)
    if (list) list.push(feature)
    else byMunicipio.set(feature.properties.municipio, [feature])
  }
  return Array.from(byMunicipio.entries())
    .map(([municipio, features]) => {
      const levelCounts = Object.fromEntries(COMPOUND_LEVELS.map((l) => [l, 0])) as Record<CompoundLevel, number>
      for (const f of features) {
        const level = f.properties.compoundLevel
        if (level) levelCounts[level]++
      }
      return {
        municipio,
        totalVeredas: features.length,
        veredasConDatos: features.filter((f) => f.properties.compoundLevel != null).length,
        levelCounts,
      }
    })
    .sort((a, b) => a.municipio.localeCompare(b.municipio, "es"))
}

function LevelCountRow({ level, count }: { level: CompoundLevel; count: number }) {
  const style = COMPOUND_LEVEL_STYLES[level]
  return (
    <li className={cn("flex items-center justify-between text-xs", count === 0 && "opacity-40")}>
      <span className="flex items-center gap-1.5 text-foreground">
        <span className={cn("size-2 rounded-full", style.swatchClass)} aria-hidden="true" />
        {level}
      </span>
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </li>
  )
}

const WEIGHTS = [
  { label: "Deslizamientos", weight: "20%" },
  { label: "Inundaciones (modelo propio)", weight: "20%" },
  { label: "Incendios forestales", weight: "20%" },
  { label: "Precipitación (acumulado 7 días)", weight: "20%" },
  { label: "Sismología (exposición por distancia)", weight: "20%" },
]

interface CompoundModelPanelProps {
  className?: string
  selectedVereda: CompoundFeature | null
  onClearSelection: () => void
}

/**
 * Below-the-map panel for the riesgo-compuesto category, modeled on
 * `FloodModelPanel`: per-municipio summary first, then the compact
 * weights/methodology summary last — data-first, methodology-last, same
 * ordering already established for the other categories. The full
 * per-hazard breakdown and narrative live in `CompoundReportDialog`
 * instead of being duplicated here.
 */
export function CompoundModelPanel({ className, selectedVereda, onClearSelection }: CompoundModelPanelProps) {
  const { veredas, isLoading } = useCompoundVeredas(true)
  const summaries = useMemo(() => (veredas ? summarizeByMunicipio(veredas) : []), [veredas])

  if (isLoading || !veredas) {
    return <Skeleton className={cn("h-[480px] rounded-xl", className)} />
  }

  const selectedProps = selectedVereda?.properties
  const selectedStyle = selectedProps?.compoundLevel ? COMPOUND_LEVEL_STYLES[selectedProps.compoundLevel] : null

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <ShieldAlert className="size-4" aria-hidden="true" />
          Cómo se calcula el riesgo compuesto
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Combina los cinco modelos de amenaza de esta app en una sola evaluación por vereda — el nivel más
          alto entre las cinco gobierna el resultado.{" "}
          <a href="/documentacion#metodologia" className="text-primary underline-offset-2 hover:underline">
            Ver metodología completa
          </a>
          .
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        {selectedProps && (
          <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {selectedStyle && (
                  <span className={cn("size-2.5 shrink-0 rounded-full", selectedStyle.swatchClass)} aria-hidden="true" />
                )}
                {selectedProps.nombre}
                <span className="text-xs font-normal text-muted-foreground">{selectedProps.municipio}</span>
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                <X className="size-3" aria-hidden="true" />
                Ver todo
              </button>
            </div>
            {selectedProps.compoundLevel ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{selectedProps.narrative.resumen}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ninguno de los cinco modelos de amenaza tiene datos suficientes para esta vereda.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resumen por municipio ({veredas.features.length} veredas en total)
          </p>
          {summaries.map((summary) => (
            <div
              key={summary.municipio}
              className={cn(
                "flex flex-col gap-2 rounded-md border border-border p-3",
                selectedProps?.municipio === summary.municipio && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{summary.municipio}</span>
                <span className="text-xs text-muted-foreground">
                  {summary.veredasConDatos}/{summary.totalVeredas} veredas con datos
                </span>
              </div>
              <ul className="flex flex-col gap-0.5 border-t border-border pt-2">
                {COMPOUND_LEVELS.map((level) => (
                  <LevelCountRow key={level} level={level} count={summary.levelCounts[level]} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Peso de cada amenaza en el puntaje compuesto
          </p>
          <ul className="flex flex-col gap-1.5">
            {WEIGHTS.map((w) => (
              <li key={w.label} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-foreground">{w.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{w.weight}</span>
              </li>
            ))}
          </ul>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
            Pesos iguales por defecto, re-normalizados sobre las amenazas que sí tengan datos para cada
            vereda. El nivel mostrado en el mapa es el mayor nivel entre las cinco (doctrina OMM/GDACS), no
            el promedio — el puntaje 0–1 es el promedio ponderado (estilo INFORM) y solo ordena veredas
            dentro de un mismo nivel. A diferencia de las otras cuatro, sismología no tiene una zonificación
            por vereda publicada — su puntaje se calcula por distancia a los epicentros de USGS y SGC.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
