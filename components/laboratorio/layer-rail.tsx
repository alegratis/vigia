"use client"

import { Mountain, Droplets, Flame, ShieldAlert, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LAYER_DEFINITIONS, LAYER_ORDER, type LayerKey } from "@/lib/laboratorio/layers"

const LAYER_ICONS: Record<LayerKey, LucideIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
  "riesgo-compuesto": ShieldAlert,
}

interface LayerRailProps {
  activeLayers: LayerKey[]
  onToggle: (layer: LayerKey) => void
  onHoverLayer: (layer: LayerKey | null) => void
}

/**
 * Narrow left-docked rail of per-layer on/off switches — the only way to
 * activate a hazard layer on the shared canvas. Hovering a layer that's
 * currently off fires `onHoverLayer` so the workspace can show a dimmed
 * preview + thumbnail without actually toggling it on.
 */
export function LayerRail({ activeLayers, onToggle, onHoverLayer }: LayerRailProps) {
  return (
    <div
      aria-label="Capas del laboratorio"
      className="absolute left-3 top-1/2 z-10 flex w-16 -translate-y-1/2 flex-col gap-1 rounded-xl border border-border/60 bg-card/80 py-3 shadow-lg backdrop-blur-md"
    >
      {LAYER_ORDER.map((layer) => {
        const def = LAYER_DEFINITIONS[layer]
        const Icon = LAYER_ICONS[layer]
        const isActive = activeLayers.includes(layer)
        return (
          <button
            key={layer}
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={def.label}
            onClick={() => onToggle(layer)}
            onMouseEnter={() => !isActive && onHoverLayer(layer)}
            onMouseLeave={() => onHoverLayer(null)}
            className={cn(
              "mx-2 flex flex-col items-center gap-1 rounded-md px-1 py-2.5 text-center transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-balance text-[10px] font-medium leading-tight">{def.shortLabel}</span>
          </button>
        )
      })}
    </div>
  )
}
