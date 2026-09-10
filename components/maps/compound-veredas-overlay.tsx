"use client"

import { useEffect, useState } from "react"
import { Polygon, Popup } from "react-leaflet"
import L from "leaflet"
import type { LatLngExpression, LeafletMouseEvent } from "leaflet"
import { useCompoundVeredas } from "@/lib/riesgo-compuesto/use-compound-veredas"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { compoundLevelColorToken } from "@/lib/riesgo-compuesto/levels"
import type { CompoundFeature } from "@/lib/riesgo-compuesto/api-types"

/** Converts a vereda's GeoJSON `[lon, lat]` MultiPolygon rings to Leaflet's `[lat, lon]` order. */
function veredaPositions(coordinates: number[][][][]): LatLngExpression[][][] {
  return coordinates.map((polygon) =>
    polygon.map((ring) => ring.map(([lon, lat]) => [lat, lon] as LatLngExpression)),
  )
}

interface CompoundVeredasOverlayProps {
  enabled: boolean
  /** Called with the clicked vereda's feature — drives the below-map model panel. */
  onSelect?: (feature: CompoundFeature) => void
  /** Called when the popup's "Ver reporte completo" button is clicked — opens the full report dialog. */
  onOpenReport?: (feature: CompoundFeature) => void
}

/**
 * Dedicated compound-risk overlay — not a `hazardKind` extension of the
 * shared `VeredasOverlay`, since this popup's payload (4 sub-hazard levels
 * + a narrative + a report button) doesn't fit `VeredaFeature`'s shape.
 * Fetches its own /api/riesgo-compuesto/veredas via `useCompoundVeredas`.
 */
export function CompoundVeredasOverlay({ enabled, onSelect, onOpenReport }: CompoundVeredasOverlayProps) {
  const { veredas } = useCompoundVeredas(enabled)
  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)

  useEffect(() => {
    setResolvedColors({
      "Muy bajo": resolveCssColor(compoundLevelColorToken("Muy bajo")),
      Bajo: resolveCssColor(compoundLevelColorToken("Bajo")),
      Moderado: resolveCssColor(compoundLevelColorToken("Moderado")),
      Alto: resolveCssColor(compoundLevelColorToken("Alto")),
      "Muy alto": resolveCssColor(compoundLevelColorToken("Muy alto")),
    })
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  if (!enabled || !veredas || !resolvedColors) return null

  return (
    <>
      {veredas.features.map((feature) => {
        const props = feature.properties
        const fillColor = props.compoundLevel ? resolvedColors[props.compoundLevel] : noDataColor ?? "#888"
        return (
          <Polygon
            key={feature.id}
            positions={veredaPositions(feature.geometry.coordinates)}
            pathOptions={{
              color: "#fff",
              weight: 1,
              opacity: 0.9,
              fillColor,
              fillOpacity: 0.65,
            }}
            eventHandlers={{
              click: (e: LeafletMouseEvent) => {
                L.DomEvent.stopPropagation(e)
                onSelect?.(feature)
              },
            }}
          >
            <Popup minWidth={220}>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                <strong>{props.nombre}</strong>
                <span style={{ color: "#888" }}>{props.municipio}</span>
                {props.compoundLevel ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        flexShrink: 0,
                        backgroundColor: resolvedColors[props.compoundLevel],
                      }}
                    />
                    Riesgo compuesto: {props.compoundLevel} · {props.actionTier}
                  </span>
                ) : (
                  <span style={{ color: "#888" }}>Sin datos suficientes para calcular el riesgo compuesto</span>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                  {props.subHazards.map((h) => (
                    <span key={h.hazard} style={{ display: "flex", alignItems: "center", gap: 6, color: "#555" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          flexShrink: 0,
                          backgroundColor: resolveCssColor(h.colorToken),
                        }}
                      />
                      {h.label}: {h.rawLevel ?? "sin datos"}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenReport?.(feature)}
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    background: "#f5f5f5",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Ver reporte completo
                </button>
              </div>
            </Popup>
          </Polygon>
        )
      })}
    </>
  )
}
