"use client"

import { Mountain, Droplets, Flame, ShieldAlert, CloudRain, Thermometer, Activity, Waves, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LAYER_DEFINITIONS, LAYER_ORDER, isExclusiveLayer, type LayerKey } from "@/lib/laboratorio/layers"

const LAYER_ICONS: Record<LayerKey, LucideIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
  "riesgo-compuesto": ShieldAlert,
  clima: Thermometer,
  precipitacion: CloudRain,
  sismologia: Activity,
  hidrantes: Waves,
  demografia: Users,
}

interface LayerRailProps {
  activeLayers: LayerKey[]
  onToggle: (layer: LayerKey) => void
  onHoverLayer: (layer: LayerKey | null) => void
}

/**
 * Row of per-layer on/off switches — the only way to activate a hazard
 * layer on the shared canvas. Docked top-center on desktop (out of the way
 * of both the map's own top-left nav controls and the right-side context
 * panel), and collapsed to a narrow left-docked vertical rail on mobile
 * where horizontal space is too tight for 9 side-by-side buttons. Hovering
 * a layer that's currently off fires `onHoverLayer` so the workspace can
 * show a dimmed preview + thumbnail without actually toggling it on.
 */
export function LayerRail({ activeLayers, onToggle, onHoverLayer }: LayerRailProps) {
  return (
    <div
      aria-label="Capas del laboratorio"
      className="absolute left-3 top-16 z-10 flex w-14 flex-col gap-1 rounded-xl border border-border/60 bg-card/80 py-2 shadow-lg backdrop-blur-md sm:left-1/2 sm:top-3 sm:w-auto sm:max-w-[min(92vw,44rem)] sm:-translate-x-1/2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-0.5 sm:px-2"
    >
      {LAYER_ORDER.map((layer) => {
        const def = LAYER_DEFINITIONS[layer]
        const Icon = LAYER_ICONS[layer]
        const isActive = activeLayers.includes(layer)
        const activeExclusive = activeLayers.find((l) => isExclusiveLayer(l))
        // Once an exclusive layer (clima/demografía/hidrantes) is on, every
        // other switch previews as "will replace it" rather than "will
        // stack" — toggling still works, it just swaps instead of adding.
        const willReplace = !isActive && Boolean(activeExclusive) && activeExclusive !== layer
        return (
          <button
            key={layer}
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={willReplace ? `${def.label} (sustituye la capa activa)` : def.label}
            onClick={() => onToggle(layer)}
            onMouseEnter={() => !isActive && onHoverLayer(layer)}
            onMouseLeave={() => onHoverLayer(null)}
            className={cn(
              "mx-1 flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors sm:mx-0 sm:px-2 sm:py-1.5",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : willReplace
                  ? "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
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
