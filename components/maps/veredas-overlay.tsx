"use client"

import { useEffect, useState } from "react"
import { Polygon, Popup } from "react-leaflet"
import L from "leaflet"
import type { LatLngExpression, LeafletMouseEvent, Path } from "leaflet"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { resolveCssColor } from "@/lib/resolve-css-color"
import type { VeredaFeature } from "@/lib/veredas/api-types"
import { isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { VeredaPopupContent } from "@/components/maps/vereda-popup-content"

/** Converts a vereda's GeoJSON `[lon, lat]` MultiPolygon rings to Leaflet's `[lat, lon]` order. */
function veredaPositions(coordinates: number[][][][]): LatLngExpression[][][] {
  return coordinates.map((polygon) =>
    polygon.map((ring) => ring.map(([lon, lat]) => [lat, lon] as LatLngExpression)),
  )
}

interface VeredasOverlayProps {
  enabled: boolean
  /**
   * Resolves a fill color for a vereda from its hazard summary — used by
   * the deslizamientos map to shade each vereda by its average landslide
   * susceptibility level. Omit on maps whose own primary layer already
   * carries the hazard color (incendios' `AmenazaIncendios` zones,
   * inundaciones' `susceptibilidad_inundaciones` zones): this overlay then
   * renders as a plain outline, just for the boundary + population/
   * infrastructure summary popup.
   */
  colorForFeature?: (feature: VeredaFeature) => string
  /** Called with the clicked vereda's feature — lets a host map drive a detail panel off the same click that opens this overlay's own popup. */
  onSelect?: (feature: VeredaFeature) => void
  /**
   * Which hazard model's fields the popup shows alongside the shared
   * population/infrastructure summary. Defaults to the landslide model
   * (the overlay's original, and still most common, use). The
   * inundaciones map passes `"inundaciones"` when it colors veredas by
   * this app's own flood model instead of a neutral outline. The
   * incendios map passes `"incendios"` for its own forest-fire model.
   */
  hazardKind?: "deslizamientos" | "inundaciones" | "sismologia" | "incendios"
  /**
   * Whether a click on a vereda polygon stops the map's own click layer
   * from also firing underneath it — the deslizamientos/incendios maps
   * have no such layer, so the default (`true`) is harmless there. The
   * inundaciones map passes `false`: its GEOGLOWS reach-identify layer is
   * opt-in via its own "Consultar río al hacer clic" toggle (see
   * ReachClickLayer in geoglows-live-map.tsx), and when that's on, a click
   * over a vereda should still reach it underneath instead of being
   * swallowed here — this overlay's own Popup opens either way, Leaflet
   * just auto-closes whichever popup opened first if both fire from the
   * same click.
   */
  blockMapClick?: boolean
  /**
   * Municipalities currently toggled on via the shared MunicipioTogglePanel.
   * Veredas outside this set render dimmed/greyed so the active ones stand
   * out; an empty/omitted set leaves every vereda at full emphasis. Popups
   * stay available on dimmed veredas too.
   */
  activeMunicipios?: string[]
}

/**
 * Shared "Límites veredales" overlay: vereda administrative boundaries with
 * a per-vereda population/infrastructure summary popup, spatially
 * aggregated server-side from data this app already fetches at the point
 * or municipio level (see lib/veredas/server.ts). Built for the
 * deslizamientos map (colored by its own landslide hazard model) and
 * reused on the inundaciones map (colored by its own flood hazard model —
 * `hazardKind="inundaciones"`, see lib/inundaciones/hazard-model.ts) and
 * the incendios map (colored by its own forest-fire hazard model —
 * `hazardKind="incendios"`, see lib/incendios/hazard-model.ts).
 */
export function VeredasOverlay({
  enabled,
  colorForFeature,
  onSelect,
  hazardKind = "deslizamientos",
  blockMapClick = true,
  activeMunicipios,
}: VeredasOverlayProps) {
  const { veredas } = useVeredas(enabled)
  const [outlineColor, setOutlineColor] = useState<string | null>(null)
  const [highlightColor, setHighlightColor] = useState<string | null>(null)
  const [mutedColor, setMutedColor] = useState<string | null>(null)

  useEffect(() => {
    setOutlineColor(resolveCssColor("var(--foreground)"))
    setHighlightColor(resolveCssColor("var(--primary)"))
    setMutedColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  if (!enabled || !veredas) return null

  return (
    <>
      {veredas.features.map((feature) => {
        const props = feature.properties
        const active = isMunicipioActive(props.municipio, activeMunicipios ?? [])
        const fillColor = colorForFeature?.(feature) ?? "transparent"
        // Dimmed (municipality toggled off): grey the fill right down and
        // fade the outline so active municipalities read as the focus.
        const dimmedPathOptions = {
          color: mutedColor ?? "#888",
          weight: 1,
          opacity: 0.3,
          fillColor: mutedColor ?? "#888",
          fillOpacity: colorForFeature ? 0.12 : 0.02,
        }
        // Active + colored: this map's hazard fill. Active + outline-only
        // (incendios/sismología/precip boundary): a clear highlighted border.
        const activePathOptions = colorForFeature
          ? { color: "#fff", weight: 1, opacity: 0.9, fillColor, fillOpacity: 0.6 }
          : {
              color: highlightColor ?? outlineColor ?? "#888",
              weight: 2,
              opacity: 0.9,
              fillColor: highlightColor ?? "transparent",
              fillOpacity: 0.06,
            }
        const basePathOptions = active ? activePathOptions : dimmedPathOptions
        // Hover elevation: a thicker, fully-opaque outline (fill untouched)
        // so a vereda visibly "lifts" under the cursor without fighting the
        // hazard fill color underneath it — same idea OSIRIS-style rails use
        // for row hover, applied here to the polygon itself.
        const hoverPathOptions = {
          ...basePathOptions,
          weight: basePathOptions.weight + 1.5,
          opacity: 1,
        }
        return (
          <Polygon
            key={feature.id}
            positions={veredaPositions(feature.geometry.coordinates)}
            pathOptions={basePathOptions}
            eventHandlers={{
              // Some host maps (e.g. deslizamientos') listen for clicks anywhere
              // on the map to run their own lookup; stop that from firing
              // underneath this polygon's own popup, same guard the OSM point
              // layers use. The inundaciones map passes `blockMapClick={false}`
              // instead, since its GEOGLOWS layer needs that same map click to
              // keep working over a vereda's fill — see the prop doc above.
              click: (e: LeafletMouseEvent) => {
                if (blockMapClick) L.DomEvent.stopPropagation(e)
                onSelect?.(feature)
              },
              mouseover: (e: LeafletMouseEvent) => {
                const layer = e.target as Path
                layer.setStyle(hoverPathOptions)
                layer.bringToFront()
              },
              mouseout: (e: LeafletMouseEvent) => {
                const layer = e.target as Path
                layer.setStyle(basePathOptions)
              },
            }}
          >
            <Popup>
              <VeredaPopupContent feature={feature} hazardKind={hazardKind} colored={!!colorForFeature} />
            </Popup>
          </Polygon>
        )
      })}
    </>
  )
}
