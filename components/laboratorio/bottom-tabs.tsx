"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { LAYER_DEFINITIONS, type LayerKey } from "@/lib/laboratorio/layers"
import type { VeredasFeatureCollection } from "@/lib/veredas/api-types"

interface BottomTabsProps {
  veredas: VeredasFeatureCollection | null
  activeLayers: LayerKey[]
}

/**
 * Fixed, collapsible bottom panel with Gráficos / Métricas / Metodología
 * tabs. When several layers are active, each tab renders one section per
 * active layer side by side rather than picking a single "focus" layer —
 * unlike the context panel, there's enough horizontal room here to compare.
 */
export function BottomTabs({ veredas, activeLayers }: BottomTabsProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={`shrink-0 border-t border-border bg-card/60 transition-[height] ${collapsed ? "h-10" : "h-[30%]"}`}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-1.5">
        <p className="text-xs font-medium text-muted-foreground">Panel de análisis</p>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expandir panel" : "Colapsar panel"}
        >
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="h-[calc(100%-2rem)] overflow-y-auto p-4">
          {activeLayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Activa una capa en el riel izquierdo para ver sus gráficos, métricas y metodología.
            </p>
          ) : (
            <Tabs defaultValue="graficos">
              <TabsList>
                <TabsTrigger value="graficos">Gráficos</TabsTrigger>
                <TabsTrigger value="metricas">Métricas</TabsTrigger>
                <TabsTrigger value="metodologia">Metodología</TabsTrigger>
              </TabsList>

              <TabsContent value="graficos" className="pt-3">
                <div className="flex flex-wrap gap-4">
                  {activeLayers.map((layer) => (
                    <LevelBarChart key={layer} veredas={veredas} layer={layer} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="metricas" className="pt-3">
                <div className="flex flex-wrap gap-6">
                  {activeLayers.map((layer) => (
                    <LayerMetrics key={layer} veredas={veredas} layer={layer} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="metodologia" className="pt-3">
                <div className="flex flex-col gap-4">
                  {activeLayers.map((layer) => (
                    <LayerMethodology key={layer} layer={layer} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </div>
  )
}

function LevelBarChart({ veredas, layer }: { veredas: VeredasFeatureCollection | null; layer: LayerKey }) {
  const def = LAYER_DEFINITIONS[layer]
  const counts = def.levels.map((level) => ({
    level,
    style: def.levelStyles[level],
    count: veredas?.features.filter((f) => f.properties[def.levelProperty] === level).length ?? 0,
  }))
  const max = Math.max(1, ...counts.map((c) => c.count))

  return (
    <div className="flex w-56 flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">{def.shortLabel}</p>
      <div className="flex h-24 items-end gap-1.5">
        {counts.map(({ level, style, count }) => (
          <div key={level} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${Math.max(4, (count / max) * 100)}%`,
                backgroundColor: style ? `var(--${style.colorToken})` : undefined,
              }}
              title={`${level}: ${count}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function LayerMetrics({ veredas, layer }: { veredas: VeredasFeatureCollection | null; layer: LayerKey }) {
  const def = LAYER_DEFINITIONS[layer]
  const scores = (veredas?.features ?? [])
    .map((f) => f.properties[def.scoreProperty] as number | null)
    .filter((v): v is number => v != null)
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const withData = scores.length
  const total = veredas?.features.length ?? 0

  return (
    <div className="flex w-56 flex-col gap-1.5 rounded-md border border-border p-3 text-sm">
      <p className="font-medium text-foreground">{def.shortLabel}</p>
      <p className="text-muted-foreground">
        Puntaje promedio: {avg != null ? avg.toFixed(2) : "sin datos"}
      </p>
      <p className="text-muted-foreground">
        Cobertura: {withData} / {total} veredas
      </p>
    </div>
  )
}

const METHODOLOGY_NOTES: Record<LayerKey, string> = {
  deslizamientos:
    "Modelo propio: pendiente del terreno + proximidad a vías + anomalía de lluvia antecedente sobre su línea base de 3 años, por vereda. Ver lib/deslizamientos/hazard-model.ts — sin cambios en este prototipo.",
  inundaciones:
    "Combina la zonificación oficial + proximidad a cuerpos de agua + planitud del terreno. Ver lib/inundaciones/hazard-model.ts — sin cambios en este prototipo.",
  incendios:
    "Pendiente y proximidad a vías (reutilizados del modelo de deslizamientos) + recurrencia histórica de focos NASA FIRMS + Índice de Peligro de Incendio (FWI) del día. Ver lib/incendios/hazard-model.ts — sin cambios en este prototipo.",
}

function LayerMethodology({ layer }: { layer: LayerKey }) {
  const def = LAYER_DEFINITIONS[layer]
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
      <p className="font-medium text-foreground">{def.label}</p>
      <p className="text-muted-foreground">{METHODOLOGY_NOTES[layer]}</p>
    </div>
  )
}
