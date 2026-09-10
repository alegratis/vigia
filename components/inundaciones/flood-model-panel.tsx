"use client"

import { Droplets, X } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { summarizeByMunicipio } from "@/lib/veredas/municipio-summary"
import {
  FLOOD_SUSCEPTIBILITY_LEVELS,
  FLOOD_SUSCEPTIBILITY_LEVEL_STYLES,
  type FloodSusceptibilityLevel,
} from "@/lib/inundaciones/levels"
import type { VeredaFeature } from "@/lib/veredas/api-types"

interface FloodModelPanelProps {
  className?: string
  /** Set when a vereda was just clicked on the map — narrows the panel to its own factors. */
  selectedVereda: VeredaFeature | null
  onClearSelection: () => void
}

/** The three static-factor inputs, in the order they combine (see lib/inundaciones/hazard-model.ts). */
const FACTORS = [
  {
    label: "1. Zonificación oficial",
    weight: "50% del puntaje",
    detail:
      "Clase de la capa pública susceptibilidad_inundaciones (ArcGIS Online), por punto-en-polígono sobre el centroide de la vereda. Es la única evidencia oficial directa, pero solo cubre el área zonificada de Sevilla y Caicedonia — ninguna vereda de Zarzal tiene esta cobertura.",
  },
  {
    label: "2. Cercanía a una quebrada o río",
    weight: "30% del puntaje",
    detail:
      "Distancia real punto-a-segmento (no al vértice más cercano) hasta la traza de quebrada o río más próxima de la capa pública de hidrografía (19 cauces con nombre). Deja de influir a partir de 1 km. Es el único factor que llega a Zarzal.",
  },
  {
    label: "3. Planicie del terreno",
    weight: "20% del puntaje",
    detail:
      "Mismo valor de pendiente ya calculado por el modelo de amenaza por deslizamiento (DEM Copernicus GLO-30, vía Open-Meteo) en el mismo centroide — sin una segunda consulta. A diferencia de ese modelo, aquí se invierte: terreno plano cerca de un cauce se inunda con más facilidad; terreno empinado drena en vez de encharcar. Satura en 8°.",
  },
]

function formatFactor(value: number | null, unit: string, digits = 1): string {
  return value != null ? `${value.toFixed(digits)}${unit}` : "—"
}

/** Small colored-dot + count row for a flood hazard level, dimmed to 0 when a municipio has no veredas at that level. */
function LevelCountRow({ level, count }: { level: FloodSusceptibilityLevel; count: number }) {
  const style = FLOOD_SUSCEPTIBILITY_LEVEL_STYLES[level]
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

/**
 * Explains, in the app itself rather than only in /documentacion, exactly
 * how the inundaciones map's "Modelo propio de inundación" vereda layer
 * is calculated: the three factors and their weights, an overall summary
 * per municipio built client-side from the same vereda data the map
 * renders (see lib/veredas/municipio-summary.ts — no extra request,
 * including each municipio's official-zoning coverage), and — once a
 * vereda is clicked on the map — that vereda's own resolved factors.
 * Mirrors HazardModelPanel's structure for the landslide model.
 */
export function FloodModelPanel({ className, selectedVereda, onClearSelection }: FloodModelPanelProps) {
  const { veredas, isLoading } = useVeredas(true)

  if (isLoading || !veredas) {
    return <Skeleton className={cn("h-[560px] rounded-xl", className)} />
  }

  const summaries = summarizeByMunicipio(veredas)
  const selectedProps = selectedVereda?.properties
  const selectedStyle = selectedProps?.floodLevel
    ? FLOOD_SUSCEPTIBILITY_LEVEL_STYLES[selectedProps.floodLevel]
    : null

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Droplets className="size-4" aria-hidden="true" />
          Cómo se calcula la amenaza por inundación
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          El color de cada vereda en la capa &quot;Modelo propio de inundación&quot; no viene de un índice
          publicado — lo calcula esta misma app, combinando los tres factores de abajo, para extender la
          zonificación oficial a las tres municipios, incluido Zarzal.{" "}
          <a href="/documentacion#metodologia" className="text-primary underline-offset-2 hover:underline">
            Ver metodología completa
          </a>
          .
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        <ul className="flex flex-col gap-3">
          {FACTORS.map((factor) => (
            <li key={factor.label} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{factor.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{factor.weight}</span>
              </div>
              <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{factor.detail}</p>
            </li>
          ))}
        </ul>

        <Separator />

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
            {selectedProps.floodLevel ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Nivel</dt>
                  <dd className="font-medium text-foreground">{selectedProps.floodLevel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Puntaje</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatFactor(selectedProps.floodScoreAvg, "", 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Quebrada más cercana</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatFactor(selectedProps.floodStreamDistanceKm, " km", 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pendiente</dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatFactor(selectedProps.slopeDeg, "°")}</dd>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-muted-foreground">Zonificación oficial</dt>
                  <dd className="font-medium text-foreground">
                    {selectedProps.floodZoningCovered
                      ? selectedProps.floodZoningLevel ?? "—"
                      : "Sin cobertura — solo modelo propio"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ningún factor del modelo se pudo calcular para esta vereda.
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
                  {summary.floodZoningCoverage.covered}/{summary.floodZoningCoverage.total} veredas con
                  zonificación oficial
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Puntaje promedio (modelo propio)</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatFactor(summary.floodScoreAvg, "", 2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>Quebrada prom.: {formatFactor(summary.floodStreamDistanceKmAvg, " km", 2)}</span>
                <span>Pendiente prom.: {formatFactor(summary.slopeDegAvg, "°")}</span>
              </div>
              <ul className="flex flex-col gap-0.5 border-t border-border pt-2">
                {FLOOD_SUSCEPTIBILITY_LEVELS.map((level) => (
                  <LevelCountRow key={level} level={level} count={summary.floodLevelCounts[level]} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
