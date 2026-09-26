"use client"

import { createRoot, type Root } from "react-dom/client"
import { Box, Square } from "lucide-react"
import type { IControl, ControlPosition } from "maplibre-gl"
import { useControl } from "react-map-gl/maplibre"

/**
 * A real MapLibre `IControl`, so it stacks inside MapLibre's own top-left
 * control group — right below the zoom +/- and compass buttons added by
 * `NavigationControl` — instead of a manually-positioned floating button
 * that can drift over other UI (the control rail, legends, etc).
 *
 * Purely a pitch/bearing convenience for now: flips the map into a tilted
 * perspective (and back to top-down) via the caller's own `easeTo` handler,
 * with no effect on which layers or data are shown.
 */
class ViewToggleControl implements IControl {
  private container: HTMLDivElement | null = null
  private root: Root | null = null
  private is3D: boolean
  private onToggle: () => void

  constructor(is3D: boolean, onToggle: () => void) {
    this.is3D = is3D
    this.onToggle = onToggle
  }

  onAdd() {
    this.container = document.createElement("div")
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group"
    this.root = createRoot(this.container)
    this.renderButton()
    return this.container
  }

  onRemove() {
    this.root?.unmount()
    this.container?.parentNode?.removeChild(this.container)
    this.container = null
    this.root = null
  }

  /** Called on every React render so the button reflects the latest state/handler without remounting the control. */
  update(is3D: boolean, onToggle: () => void) {
    this.is3D = is3D
    this.onToggle = onToggle
    this.renderButton()
  }

  private renderButton() {
    if (!this.root) return
    // Show the icon for the view the button will switch TO, not the current one,
    // so the glyph reads as "press this to get 3D" / "press this to get 2D".
    const Icon = this.is3D ? Square : Box
    this.root.render(
      <button
        type="button"
        onClick={() => this.onToggle()}
        aria-pressed={this.is3D}
        aria-label={this.is3D ? "Cambiar a vista 2D" : "Cambiar a vista 3D"}
        title={this.is3D ? "Vista 2D" : "Vista 3D"}
        className="maplibregl-ctrl-icon flex items-center justify-center"
        style={{ color: "#333" }}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>,
    )
  }
}

interface MapViewToggleControlProps {
  is3D: boolean
  onToggle: () => void
  position?: ControlPosition
}

/** React wrapper that mounts `ViewToggleControl` onto the map via `useControl`. */
export function MapViewToggleControl({ is3D, onToggle, position = "top-left" }: MapViewToggleControlProps) {
  const control = useControl<ViewToggleControl>(() => new ViewToggleControl(is3D, onToggle), { position })
  control.update(is3D, onToggle)
  return null
}
