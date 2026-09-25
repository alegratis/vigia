"use client"

import { useState, type ReactNode, type ComponentType } from "react"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface MapControlRailProps {
  /** Stacked sections — municipio toggles, layer groups, active legends — in one scroll area. */
  children: ReactNode
  /** Collapsed by default on first mount. */
  defaultCollapsed?: boolean
  className?: string
}

/**
 * Unified side-rail control surface for every hazard map: replaces the
 * per-corner floating clusters (municipio toggle top-center, layer toggles
 * top-left, legends bottom-left/right) with one collapsible panel docked to
 * the map's right edge, so every map shares the same control language
 * instead of eight divergent layouts.
 *
 * Docks to the right edge on desktop; becomes a bottom sheet on narrow
 * viewports so it never covers the map's horizontal extent on mobile.
 */
export function MapControlRail({ children, defaultCollapsed = false, className }: MapControlRailProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Mostrar controles del mapa"
        className={cn(
          "absolute right-3 top-3 z-[400] flex size-9 items-center justify-center rounded-md border border-border bg-card/80 text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-card",
          className,
        )}
      >
        <PanelRightOpen className="size-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <div
      className={cn(
        "absolute z-[400] flex flex-col overflow-hidden rounded-md border border-border bg-card/80 text-xs shadow-sm backdrop-blur-md",
        // Desktop: docked right edge, capped height with its own scroll area.
        "right-3 top-3 bottom-3 w-72",
        // Mobile: bottom sheet spanning the map width instead.
        "max-sm:left-3 max-sm:right-3 max-sm:top-auto max-sm:bottom-3 max-sm:max-h-[45%] max-sm:w-auto",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <p className="font-medium text-foreground">Controles del mapa</p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Ocultar controles del mapa"
          className="flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightClose className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto px-3 py-3">{children}</div>
    </div>
  )
}

/** Titled group within the rail — a consistent heading + divider between sections. */
export function RailSection({
  title,
  children,
  first,
}: {
  title: string
  children: ReactNode
  /** Omits the top divider for the first section in the rail. */
  first?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", !first && "border-t border-border/70 pt-3")}>
      <p className="font-medium text-foreground">{title}</p>
      {children}
    </div>
  )
}

/** Consistent icon + label + checkbox row for a toggleable overlay layer. */
export function RailToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-sm px-1.5 py-1 -mx-1.5 font-medium text-foreground transition-colors",
        "hover:bg-muted/70",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 accent-primary"
      />
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-pretty">{label}</span>
    </label>
  )
}
