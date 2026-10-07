"use client"

import { Fragment, type ComponentType } from "react"
import { Mountain, Droplets, Flame, ShieldAlert, CloudRain, Thermometer, Activity, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { LAYER_DEFINITIONS, LAYER_GROUPS, isExclusiveLayer, type LayerKey } from "@/lib/laboratorio/layers"
import { HydrantIcon } from "@/components/laboratorio/hydrant-icon"

type RailIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>

const LAYER_ICONS: Record<LayerKey, RailIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
  "riesgo-compuesto": ShieldAlert,
  clima: Thermometer,
  precipitacion: CloudRain,
  sismologia: Activity,
  hidrantes: HydrantIcon,
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
      className="absolute left-3 top-16 z-10 flex w-[4.5rem] flex-col gap-1 rounded-xl border border-border/60 bg-card/80 py-2 shadow-lg backdrop-blur-md sm:left-1/2 sm:top-3 sm:w-auto sm:max-w-[min(92vw,44rem)] sm:-translate-x-1/2 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-center sm:gap-0.5 sm:px-2"
    >
      {LAYER_GROUPS.map((group, groupIndex) => (
        <Fragment key={group[0]}>
          {groupIndex > 0 && (
            <span
              role="separator"
              aria-orientation="vertical"
              className="mx-2 my-0.5 h-px shrink-0 bg-border sm:mx-1 sm:my-1 sm:h-auto sm:w-px"
            />
          )}
          {group.map((layer) => {
            const def = LAYER_DEFINITIONS[layer]
            const Icon = LAYER_ICONS[layer]
            const isActive = activeLayers.includes(layer)
            const activeExclusive = activeLayers.find((l) => isExclusiveLayer(l))
            // Only deslizamientos/inundaciones/incendios stack. Once any other layer is on (or when
            // turning one on while something is active) the swap replaces the canvas instead of adding.
            const willReplace =
              !isActive &&
              ((Boolean(activeExclusive) && activeExclusive !== layer) ||
                (isExclusiveLayer(layer) && activeLayers.length > 0))
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
                  "mx-0.5 flex flex-col items-center gap-1 rounded-md px-0.5 py-2 text-center transition-colors sm:mx-0 sm:px-2 sm:py-1.5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : willReplace
                      ? "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="max-w-full text-balance break-words text-[9px] font-medium leading-tight sm:text-[10px]">
                  {def.shortLabel}
                </span>
              </button>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
