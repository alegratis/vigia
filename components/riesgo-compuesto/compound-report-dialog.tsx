"use client"

import { CloudRain, Droplets, Flame, MapPin, Mountain, type LucideIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { COMPOUND_LEVEL_STYLES } from "@/lib/riesgo-compuesto/levels"
import type { CompoundFeature } from "@/lib/riesgo-compuesto/api-types"

const HAZARD_ICONS: Record<string, LucideIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
  precipitacion: CloudRain,
}

/**
 * Full expandable compound-risk report for one vereda — same dialog
 * interaction pattern as `StationDetailDialog` (open/close driven by
 * whether `feature` is set). Data-first, methodology-last: narrative,
 * per-hazard breakdown, and demographics all come before the "how this is
 * calculated" explanation, matching the ordering convention already
 * established by the inundaciones model panel.
 */
export function CompoundReportDialog({
  feature,
  onOpenChange,
}: {
  feature: CompoundFeature | null
  onOpenChange: (open: boolean) => void
}) {
  const props = feature?.properties

  return (
    <Dialog open={feature != null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {props && (
          <>
            <DialogHeader className="shrink-0 gap-2 border-b border-border px-6 py-5 text-left">
              <DialogDescription className="inline-flex items-center gap-1.5 text-sm">
                <MapPin className="size-4" aria-hidden="true" />
                {props.municipio}
              </DialogDescription>
              <DialogTitle className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                {props.nombre}
              </DialogTitle>
              {props.compoundLevel && props.actionTier ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className="text-white"
                    style={{ backgroundColor: resolveCssColor(COMPOUND_LEVEL_STYLES[props.compoundLevel].colorToken) }}
                  >
                    Riesgo compuesto: {props.compoundLevel}
                  </Badge>
                  <Badge variant="outline">{props.actionTier}</Badge>
                  {props.compoundScore != null && (
                    <span className="text-xs text-muted-foreground">Puntaje: {props.compoundScore.toFixed(2)}</span>
                  )}
                </div>
              ) : (
                <Badge variant="outline">Sin datos suficientes</Badge>
              )}
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-pretty text-sm leading-relaxed text-foreground">{props.narrative.resumen}</p>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {props.narrative.demografia}
                  </p>
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Desglose por amenaza
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {props.subHazards.map((h) => {
                      const Icon = HAZARD_ICONS[h.hazard] ?? Mountain
                      return (
                        <div key={h.hazard} className="flex flex-col gap-1 rounded-md border border-border p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="size-4 shrink-0" style={{ color: resolveCssColor(h.colorToken) }} aria-hidden="true" />
                            <span className="text-sm font-medium text-foreground">{h.label}</span>
                          </div>
                          <span className="text-sm text-foreground">{h.rawLevel ?? "Sin datos"}</span>
                          {h.detail && <span className="text-xs text-muted-foreground">{h.detail}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Metodología
                  </p>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    El nivel de riesgo compuesto es el mayor nivel entre las cuatro amenazas (deslizamientos,
                    inundaciones, incendios y precipitación), cada una normalizada a una escala de 0 a 1 —
                    la doctrina de la OMM/GDACS de que &quot;la amenaza más alta gobierna&quot;: un solo
                    riesgo severo nunca se diluye con otros tres tranquilos. El puntaje (0–1) es, en cambio,
                    un promedio ponderado de las cuatro (25% cada una, re-normalizado sobre las que sí
                    tengan datos para esta vereda) — al estilo del Índice de Riesgo INFORM — y sirve para
                    comparar veredas dentro del mismo nivel, no para definir el nivel en sí. El nivel
                    compuesto se traduce además al marco de Informar/Prepararse/Actuar que ya usa IDEAM en
                    sus propios boletines públicos. No incluye el pronóstico de caudal en vivo de GEOGLOWS —
                    ese pronóstico es por tramo de río, no por vereda, y el modelo propio de inundación
                    (zonificación + cercanía a cauce + planicie del terreno) ya representa esa amenaza aquí,
                    igual que en las otras tres categorías.{" "}
                    <a href="/documentacion#metodologia" className="text-primary underline-offset-2 hover:underline">
                      Ver metodología completa
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
