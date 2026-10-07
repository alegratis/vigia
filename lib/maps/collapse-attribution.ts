import type { MapLibreEvent } from "maplibre-gl"

/**
 * MapLibre's compact AttributionControl renders as a native <details>
 * element that ships with `open` + `maplibregl-compact-show` applied on
 * first render, so the "i" button starts expanded showing the full
 * "Map data © OpenStreetMap..." text instead of collapsed to just the
 * icon. There's no prop to change this initial state, so we force it
 * collapsed right after load. The library's own toggle button
 * (`_toggleAttribution`) only reads these same classes/attribute, so
 * clicking it afterwards still expands/collapses normally.
 */
export function collapseAttributionControl(event: MapLibreEvent) {
  const container = event.target.getContainer()
  const attribs = container.querySelectorAll<HTMLDetailsElement>(".maplibregl-ctrl-attrib.maplibregl-compact-show")
  for (const attrib of attribs) {
    attrib.removeAttribute("open")
    attrib.classList.remove("maplibregl-compact-show")
  }
}
