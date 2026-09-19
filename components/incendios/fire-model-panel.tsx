"use client"

import { Flame, X } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { summarizeByMunicipio } from "@/lib/veredas/municipio-summary"
import { FIRE_THREAT_LEVELS, FIRE_THREAT_LEVEL_STYLES, type FireThreatLevel } from "@/lib/incendios/levels"
import type { VeredaFeature } from "@/lib/veredas/api-types"

interface FireModelPanelProps {
  className?: string
  /** Set when a vereda was just clicked on the map — narrows the panel to its own factors. */
  selectedVereda: VeredaFeature | null
  onClearSelection: () => void
}

/** The two static-factor inputs plus the dynamic trigger, in the order they combine (see lib/incendios/hazard-model.ts). */
const FACTORS = [
  {
    label: "1. Pendiente y cercanía a la vía más cercana",
    weight: "40% del puntaje (25% + 15%)",
    detail:
      "Reutiliza directamente la pendiente y la distancia a la vía más cercana ya calculadas por el modelo de amenaza por deslizamiento en el mismo centroide, sin una segunda consulta. Terreno más empinado propaga el fuego más rápido; la mayoría de los incendios forestales en Colombia son de origen humano (quemas agrícolas, fuego escapado), así que la cercanía a una vía es un indicio real de riesgo de ignición.",
  },
  {
    label: "2. Recurrencia histórica de incendios (NASA FIRMS)",
    weight: "60% del puntaje",
    detail:
      "Detecciones VIIRS (375 m) dentro de 2 km del centroide, en los últimos 150 días, contando focos hasta un tope de 3 (recurrencia_score = min(1, focos / 3)). Es evidencia directa de dónde ha ardido antes, no un indicio indirecto como los otros dos factores estáticos — por eso recibe el mayor peso del factor estático, el mismo rol que cumple el inventario histórico de movimientos en masa en el modelo de deslizamiento.",
  },
  {
    label: "3. Índice Meteorológico de Incendio (FWI) de hoy",
    weight: "40% del puntaje final",
    detail:
      "El Sistema Canadiense de Índices Forestales de Incendio (Van Wagner, 1987), calculado con las ecuaciones estándar a partir de temperatura, humedad relativa, viento y lluvia diaria (archivo histórico de Open-Meteo), con 60 días de \"arranque\" para que los códigos de humedad de combustible converjan. Se satura en FWI = 30, el límite de la clase \"Extremo\" del sistema original.",
  },
]

function formatFactor(value: number | null, unit: string, digits = 1): string {
  return value != null ? `${value.toFixed(digits)}${unit}` : "—"
}

/** Small colored-dot + count row for a fire hazard level, dimmed to 0 when a municipio has no veredas at that level. */
function LevelCountRow({ level, count }: { level: FireThreatLevel; count: number }) {
  const style = FIRE_THREAT_LEVEL_STYLES[level]
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
 * how the incendios map's "Modelo propio de incendios forestales" vereda
 * layer is calculated. Data-first, methodology-last: an overall summary
 * per municipio built client-side from the same vereda data the map
 * renders (see lib/veredas/municipio-summary.ts — no extra request),
 * then — once a vereda is clicked on the map — that vereda's own
 * resolved factors, and finally the factors and their weights that
 * produced all of the above. Mirrors FloodModelPanel's structure.
 */
export function FireModelPanel({ className, selectedVereda, onClearSelection }: FireModelPanelProps) {
  const { veredas, isLoading } = useVeredas(true)

  if (isLoading || !veredas) {
    return <Skeleton className={cn("h-[560px] rounded-xl", className)} />
  }

  const summaries = summarizeByMunicipio(veredas)
  const selectedProps = selectedVereda?.properties
  const selectedStyle = selectedProps?.fireLevel ? FIRE_THREAT_LEVEL_STYLES[selectedProps.fireLevel] : null

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Flame className="size-4" aria-hidden="true" />
          Cómo se calcula la amenaza por incendio forestal
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          El color de cada vereda en la capa &quot;Modelo propio de incendios forestales&quot; no viene de la
          zonificación oficial (PBOT 2014) — lo calcula esta misma app, combinando los tres factores de abajo,
          para cubrir las tres municipios, incluido Zarzal, que la zonificación oficial nunca cubrió.{" "}
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
            {selectedProps.fireLevel ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Nivel</dt>
                  <dd className="font-medium text-foreground">{selectedProps.fireLevel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Puntaje</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatFactor(selectedProps.fireScoreAvg, "", 2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Focos históricos (150 días)</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {selectedProps.fireHistoryCount ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">FWI hoy</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatFactor(selectedProps.fireFwi, "", 1)}
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
                <span className="text-xs text-muted-foreground">{summary.totalVeredas} veredas</span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Puntaje promedio (modelo propio)</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatFactor(summary.fireScoreAvg, "", 2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>Focos históricos prom.: {formatFactor(summary.fireHistoryCountAvg, "", 1)}</span>
                <span>FWI prom.: {formatFactor(summary.fireFwiAvg, "", 1)}</span>
              </div>
              <ul className="flex flex-col gap-0.5 border-t border-border pt-2">
                {FIRE_THREAT_LEVELS.map((level) => (
                  <LevelCountRow key={level} level={level} count={summary.fireLevelCounts[level]} />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cómo se calcula el puntaje
          </p>
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
        </div>
      </CardContent>
    </Card>
  )
}
