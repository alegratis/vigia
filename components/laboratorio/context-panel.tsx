"use client"

import Image from "next/image"
import { LAYER_DEFINITIONS, levelSeverity, type LayerKey } from "@/lib/laboratorio/layers"
import type { VeredasFeatureCollection } from "@/lib/veredas/api-types"
import { Badge } from "@/components/ui/badge"

interface ContextPanelProps {
  veredas: VeredasFeatureCollection | null
  activeLayers: LayerKey[]
  /** Last layer turned on — drives which legend/metrics show when several are active. */
  lastActivatedLayer: LayerKey | null
  previewLayer: LayerKey | null
}

/**
 * Right-docked contextual panel: shows a compound "most severe hazard
 * wins" summary when no layer is active, the hovered-but-off layer's
 * thumbnail + affected-vereda count during a rail hover preview, or the
 * most-recently-activated active layer's legend + per-level vereda counts
 * otherwise.
 */
export function ContextPanel({ veredas, activeLayers, lastActivatedLayer, previewLayer }: ContextPanelProps) {
  if (previewLayer) {
    return <PreviewSummary veredas={veredas} layer={previewLayer} />
  }

  if (activeLayers.length === 0) {
    return <CompoundSummary veredas={veredas} />
  }

  const focusLayer = lastActivatedLayer && activeLayers.includes(lastActivatedLayer) ? lastActivatedLayer : activeLayers[activeLayers.length - 1]

  return <LayerLegend veredas={veredas} layer={focusLayer} activeLayers={activeLayers} />
}

function PreviewSummary({ veredas, layer }: { veredas: VeredasFeatureCollection | null; layer: LayerKey }) {
  const def = LAYER_DEFINITIONS[layer]
  const count = veredas?.features.filter((f) => f.properties[def.levelProperty]).length ?? 0

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border">
        <Image src={def.image || "/placeholder.svg"} alt={def.imageAlt} fill className="object-cover" />
      </div>
      <div>
        <p className="font-medium text-foreground">{def.label}</p>
        <p className="text-sm text-muted-foreground">{count} veredas con dato de esta capa</p>
      </div>
      <p className="text-xs text-muted-foreground">Clic en el riel para activarla sobre el mapa.</p>
    </div>
  )
}

function CompoundSummary({ veredas }: { veredas: VeredasFeatureCollection | null }) {
  if (!veredas) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando datos de veredas…</p>
  }

  const layers: LayerKey[] = ["deslizamientos", "inundaciones", "incendios"]
  const ranked = veredas.features
    .map((feature) => {
      let worst = -1
      let worstLayer: LayerKey | null = null
      for (const layer of layers) {
        const def = LAYER_DEFINITIONS[layer]
        const level = feature.properties[def.levelProperty] as string | null
        const severity = levelSeverity(layer, level)
        if (severity > worst) {
          worst = severity
          worstLayer = layer
        }
      }
      return { feature, worst, worstLayer }
    })
    .filter((entry) => entry.worst >= 0)
    .sort((a, b) => b.worst - a.worst)
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium text-foreground">Riesgo compuesto</p>
        <p className="text-sm text-muted-foreground">
          Ninguna capa activa — veredas ordenadas por su amenaza más severa entre las 3 capas disponibles.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {ranked.map(({ feature, worstLayer }) => (
          <li key={feature.properties.codigoVereda} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{feature.properties.nombre}</span>
            {worstLayer && (
              <Badge variant="secondary" className="shrink-0">
                {LAYER_DEFINITIONS[worstLayer].shortLabel}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LayerLegend({
  veredas,
  layer,
  activeLayers,
}: {
  veredas: VeredasFeatureCollection | null
  layer: LayerKey
  activeLayers: LayerKey[]
}) {
  const def = LAYER_DEFINITIONS[layer]
  const counts = def.levels.map((level) => ({
    level,
    style: def.levelStyles[level],
    count: veredas?.features.filter((f) => f.properties[def.levelProperty] === level).length ?? 0,
  }))

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium text-foreground">{def.label}</p>
        {activeLayers.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {activeLayers.length} capas activas — mostrando la última activada
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {counts.map(({ level, style, count }) => (
          <li key={level} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: style ? `var(--${style.colorToken})` : undefined }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-foreground">{level}</span>
            <span className="text-muted-foreground">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
