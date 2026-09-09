"use client"

import { Mountain, X } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { summarizeByMunicipio } from "@/lib/veredas/municipio-summary"
import { SUSCEPTIBILITY_LEVELS, SUSCEPTIBILITY_LEVEL_STYLES, type SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import type { VeredaFeature } from "@/lib/veredas/api-types"

interface HazardModelPanelProps {
  className?: string
  /** Set when a vereda was just clicked on the map — narrows the panel to its own factors. */
  selectedVereda: VeredaFeature | null
  onClearSelection: () => void
}

/** The three static-factor inputs and the dynamic trigger, in the order they combine (see lib/deslizamientos/hazard-model.ts). */
const FACTORS = [
  {
    label: "1. Pendiente del terreno",
    weight: "50% del factor estático",
    detail:
      "Gradiente de elevación por diferencias finitas (DEM Copernicus GLO-30, vía Open-Meteo), muestreado en el centroide de la vereda y sus 4 vecinos cardinales. Satura en 45°.",
  },
  {
    label: "2. Cercanía a la vía más cercana",
    weight: "20% del factor estático",
    detail:
      "Distancia Haversine desde el centroide al vértice más cercano de la red vial de OpenStreetMap (Overpass). Deja de influir a partir de 1 km.",
  },
  {
    label: "3. Cercanía a una falla geológica",
    weight: "30% del factor estático",
    detail:
      "Distancia real punto-a-segmento (no al vértice más cercano) hasta la traza de falla más próxima del Servicio Geológico Colombiano (SGC), Atlas Geológico de Colombia. Deja de influir a partir de 2 km. También disponible como capa independiente en el mapa.",
  },
  {
    label: "4. Anomalía de lluvia reciente",
    weight: "40% del puntaje final",
    detail:
      "Índice de lluvia de los últimos 15 días con decaimiento (vida media de 4 días) contra el promedio del mismo índice hace 1, 2 y 3 años. Satura al doblar ese promedio histórico.",
  },
]

function formatFactor(value: number | null, unit: string, digits = 1): string {
  return value != null ? `${value.toFixed(digits)}${unit}` : "—"
}

/** Small colored-dot + count row for a hazard level, dimmed to 0 when a municipio has no veredas at that level. */
function LevelCountRow({ level, count }: { level: SusceptibilityLevel; count: number }) {
  const style = SUSCEPTIBILITY_LEVEL_STYLES[level]
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
 * how the deslizamientos map's colors are calculated: the three factors
 * and their weights, an overall summary per municipio built client-side
 * from the same vereda data the map renders (see
 * lib/veredas/municipio-summary.ts — no extra request), and — once a
 * vereda is clicked on the map — that vereda's own resolved factors.
 */
export function HazardModelPanel({ className, selectedVereda, onClearSelection }: HazardModelPanelProps) {
  const { veredas, isLoading } = useVeredas(true)

  if (isLoading || !veredas) {
    return <Skeleton className={cn("h-[560px] rounded-xl", className)} />
  }

  const summaries = summarizeByMunicipio(veredas)
  const selectedProps = selectedVereda?.properties
  const selectedStyle = selectedProps?.dominantLevel
    ? SUSCEPTIBILITY_LEVEL_STYLES[selectedProps.dominantLevel as SusceptibilityLevel]
    : null

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Mountain className="size-4" aria-hidden="true" />
          Cómo se calcula la amenaza
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          El color de cada vereda en el mapa no viene de un índice publicado por RED LabOT — lo calcula esta
          misma app, combinando los tres factores de abajo.{" "}
          <a
            href="/documentacion#metodologia"
            className="text-primary underline-offset-2 hover:underline"
          >
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
            {selectedProps.dominantLevel ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Nivel</dt>
                  <dd className="font-medium text-foreground">{selectedProps.dominantLevel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Puntaje</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatFactor(selectedProps.isScoreAvg, "", 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pendiente</dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatFactor(selectedProps.slopeDeg, "°")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Vía más cercana</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatFactor(selectedProps.roadDistanceKm, " km", 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Falla más cercana</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatFactor(selectedProps.faultDistanceKm, " km", 2)}
                  </dd>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-muted-foreground">Lluvia reciente vs. histórico (3 años)</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {selectedProps.rainfallRatio != null ? `${(selectedProps.rainfallRatio * 100).toFixed(0)}%` : "—"}
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
                  {summary.veredasConDatos}/{summary.totalVeredas} veredas con datos
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Puntaje promedio</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatFactor(summary.scoreAvg, "", 2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>Pendiente prom.: {formatFactor(summary.slopeDegAvg, "°")}</span>
                <span>Vía prom.: {formatFactor(summary.roadDistanceKmAvg, " km", 2)}</span>
                <span>Falla prom.: {formatFactor(summary.faultDistanceKmAvg, " km", 2)}</span>
              </div>
              <ul className="flex flex-col gap-0.5 border-t border-border pt-2">
                {SUSCEPTIBILITY_LEVELS.map((level) => (
                  <LevelCountRow key={level} level={level} count={summary.levelCounts[level]} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
