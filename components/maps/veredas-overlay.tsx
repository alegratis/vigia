"use client"

import { useEffect, useState } from "react"
import { Polygon, Popup } from "react-leaflet"
import L from "leaflet"
import type { LatLngExpression, LeafletMouseEvent } from "leaflet"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { resolveCssColor } from "@/lib/resolve-css-color"
import type { VeredaFeature } from "@/lib/veredas/api-types"

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
}

/**
 * Shared "Límites veredales" overlay: vereda administrative boundaries with
 * a per-vereda population/infrastructure summary popup, spatially
 * aggregated server-side from data this app already fetches at the point
 * or municipio level (see lib/veredas/server.ts). Built for the
 * deslizamientos map and reused as a neutral reference layer on the
 * incendios and inundaciones maps.
 */
export function VeredasOverlay({ enabled, colorForFeature }: VeredasOverlayProps) {
  const { veredas } = useVeredas(enabled)
  const [outlineColor, setOutlineColor] = useState<string | null>(null)

  useEffect(() => {
    setOutlineColor(resolveCssColor("var(--foreground)"))
  }, [])

  if (!enabled || !veredas) return null

  return (
    <>
      {veredas.features.map((feature) => {
        const props = feature.properties
        const fillColor = colorForFeature?.(feature) ?? "transparent"
        return (
          <Polygon
            key={feature.id}
            positions={veredaPositions(feature.geometry.coordinates)}
            pathOptions={{
              color: colorForFeature ? "#fff" : outlineColor ?? "#888",
              weight: 1,
              opacity: colorForFeature ? 0.9 : 0.6,
              fillColor,
              fillOpacity: colorForFeature ? 0.6 : 0.04,
            }}
            eventHandlers={{
              // Some host maps (e.g. GEOGLOWS') listen for clicks anywhere on the
              // map to run their own lookup; stop that from firing underneath
              // this polygon's own popup, same guard the OSM point layers use.
              click: (e: LeafletMouseEvent) => L.DomEvent.stopPropagation(e),
            }}
          >
            <Popup>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                <strong>{props.nombre}</strong>
                <span>{props.municipio}</span>
                {colorForFeature && props.dominantLevel && (
                  <span>
                    Amenaza (modelo propio): {props.dominantLevel}
                    {props.isScoreAvg != null && ` (${props.isScoreAvg.toFixed(2)})`}
                  </span>
                )}
                {colorForFeature && !props.dominantLevel && (
                  <span style={{ color: "#888" }}>Sin datos del modelo de amenaza</span>
                )}
                {colorForFeature && (props.slopeDeg != null || props.roadDistanceKm != null || props.rainfallRatio != null) && (
                  <span style={{ color: "#888" }}>
                    {props.slopeDeg != null && `Pendiente: ${props.slopeDeg.toFixed(1)}°`}
                    {props.slopeDeg != null && (props.roadDistanceKm != null || props.rainfallRatio != null) && " · "}
                    {props.roadDistanceKm != null && `Vía más cercana: ${props.roadDistanceKm.toFixed(2)} km`}
                    {props.roadDistanceKm != null && props.rainfallRatio != null && " · "}
                    {props.rainfallRatio != null && `Lluvia vs. histórico: ${(props.rainfallRatio * 100).toFixed(0)}%`}
                  </span>
                )}
                <span>
                  Población estimada:{" "}
                  {props.poblacion != null ? Math.round(props.poblacion).toLocaleString("es-CO") : "—"}
                </span>
                <span>
                  Escuelas: {props.escuelas ?? "—"} · Hospitales: {props.hospitales ?? "—"} · Farmacias:{" "}
                  {props.farmacias ?? "—"}
                </span>
                <span>Infraestructura crítica: {props.infraestructuraCritica ?? "—"}</span>
                <span>Sitios críticos (2019): {props.sitiosCriticos}</span>
              </div>
            </Popup>
          </Polygon>
        )
      })}
    </>
  )
}
