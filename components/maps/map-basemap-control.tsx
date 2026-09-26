"use client"

import { createRoot, type Root } from "react-dom/client"
import { Map as MapIcon, Layers, Moon, Satellite, type LucideIcon } from "lucide-react"
import type { IControl, ControlPosition } from "maplibre-gl"
import { useControl } from "react-map-gl/maplibre"
import type { BasemapType } from "@/lib/maps/maplibre-basemap-style"

interface BasemapOption {
  value: BasemapType
  label: string
  Icon: LucideIcon
}

const BASEMAP_OPTIONS: BasemapOption[] = [
  { value: "osm", label: "OSM estándar", Icon: MapIcon },
  { value: "hybrid", label: "Híbrido", Icon: Layers },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "satellite", label: "Satélite", Icon: Satellite },
]

/**
 * A real MapLibre `IControl` — same rationale as `ViewToggleControl` in
 * `map-view-toggle-control.tsx` (stacks inside MapLibre's own control
 * group instead of a floating button that can drift over other UI). This
 * one opens a small dropdown of the four basemap themes on click rather
 * than toggling a single boolean, since there are more than two states.
 */
class BasemapControl implements IControl {
  private container: HTMLDivElement | null = null
  private root: Root | null = null
  private basemap: BasemapType
  private onChange: (basemap: BasemapType) => void
  private isOpen = false

  constructor(basemap: BasemapType, onChange: (basemap: BasemapType) => void) {
    this.basemap = basemap
    this.onChange = onChange
  }

  onAdd() {
    this.container = document.createElement("div")
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group"
    this.root = createRoot(this.container)
    this.render()
    return this.container
  }

  onRemove() {
    this.root?.unmount()
    this.container?.parentNode?.removeChild(this.container)
    this.container = null
    this.root = null
  }

  /** Called on every React render so the control reflects the latest state/handler without remounting. */
  update(basemap: BasemapType, onChange: (basemap: BasemapType) => void) {
    this.basemap = basemap
    this.onChange = onChange
    this.render()
  }

  private toggleOpen = () => {
    this.isOpen = !this.isOpen
    this.render()
  }

  private select = (value: BasemapType) => {
    this.isOpen = false
    this.onChange(value)
    this.render()
  }

  private render() {
    if (!this.root) return
    const current = BASEMAP_OPTIONS.find((option) => option.value === this.basemap) ?? BASEMAP_OPTIONS[0]

    this.root.render(
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={this.toggleOpen}
          aria-expanded={this.isOpen}
          aria-label={`Estilo de mapa: ${current.label}`}
          title="Estilo de mapa"
          className="maplibregl-ctrl-icon"
          // `.maplibregl-ctrl-group button{display:block}` outranks the Tailwind
          // `flex` utility class on specificity, so the centering has to be inline.
          style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}
        >
          <current.Icon className="size-4" aria-hidden="true" />
        </button>
        {this.isOpen && (
          <div
            role="menu"
            className="font-sans absolute left-full top-0 ml-2 flex flex-col gap-0.5 overflow-hidden rounded-lg border p-1.5 shadow-lg"
            // Inline colors (not Tailwind bg-popover/border classes) because this
            // control is mounted outside the app's Tailwind-processed subtree via
            // `createRoot`, so `oklch(var(--popover))`-based utility classes never
            // resolve here — read the CSS custom properties directly instead.
            style={{
              minWidth: "11rem",
              backgroundColor: "var(--popover)",
              borderColor: "var(--border)",
            }}
          >
            {BASEMAP_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === this.basemap}
                onClick={() => this.select(option.value)}
                className="w-full gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors hover:opacity-80"
                // Same specificity issue as the trigger button above:
                // `.maplibregl-ctrl-group button{display:block}` outranks the
                // Tailwind `flex` utility, so icon+label stack instead of
                // sitting side by side unless forced inline.
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "var(--popover-foreground)",
                  backgroundColor: option.value === this.basemap ? "var(--accent)" : "transparent",
                }}
              >
                <option.Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap leading-none">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>,
    )
  }
}

interface MapBasemapControlProps {
  basemap: BasemapType
  onChange: (basemap: BasemapType) => void
  position?: ControlPosition
}

/** React wrapper that mounts `BasemapControl` onto the map via `useControl`. */
export function MapBasemapControl({ basemap, onChange, position = "top-left" }: MapBasemapControlProps) {
  const control = useControl<BasemapControl>(() => new BasemapControl(basemap, onChange), { position })
  control.update(basemap, onChange)
  return null
}
