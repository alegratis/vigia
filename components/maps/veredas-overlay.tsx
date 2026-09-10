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
  /** Called with the clicked vereda's feature — lets a host map drive a detail panel off the same click that opens this overlay's own popup. */
  onSelect?: (feature: VeredaFeature) => void
  /**
   * Which hazard model's fields the popup shows alongside the shared
   * population/infrastructure summary. Defaults to the landslide model
   * (the overlay's original, and still most common, use). The
   * inundaciones map passes `"inundaciones"` when it colors veredas by
   * this app's own flood model instead of a neutral outline.
   */
  hazardKind?: "deslizamientos" | "inundaciones"
  /**
   * Whether a click on a vereda polygon stops the map's own click layer
   * from also firing underneath it — the deslizamientos/incendios maps
   * have no such layer, so the default (`true`) is harmless there. The
   * inundaciones map passes `false`: its GEOGLOWS river layer relies on a
   * generic map click to identify the reach under the cursor, and that
   * should keep working even over a vereda's fill. When `false`, this
   * overlay also skips its own Popup — the vereda's own summary stays
   * available through `onSelect`'s sidebar narrowing instead of a competing
   * popup — and the click still reaches GEOGLOWS underneath.
   */
  blockMapClick?: boolean
}

/**
 * Shared "Límites veredales" overlay: vereda administrative boundaries with
 * a per-vereda population/infrastructure summary popup, spatially
 * aggregated server-side from data this app already fetches at the point
 * or municipio level (see lib/veredas/server.ts). Built for the
 * deslizamientos map (colored by its own landslide hazard model) and
 * reused on the inundaciones map (colored by its own flood hazard model —
 * `hazardKind="inundaciones"`, see lib/inundaciones/hazard-model.ts) and
 * as a neutral outline reference layer on incendios.
 */
export function VeredasOverlay({
  enabled,
  colorForFeature,
  onSelect,
  hazardKind = "deslizamientos",
  blockMapClick = true,
}: VeredasOverlayProps) {
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
            }}
          >
            {blockMapClick && <Popup>
              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                <strong>{props.nombre}</strong>
                <span>{props.municipio}</span>
                {colorForFeature && hazardKind === "deslizamientos" && props.dominantLevel && (
                  <span>
                    Amenaza (modelo propio): {props.dominantLevel}
                    {props.isScoreAvg != null && ` (${props.isScoreAvg.toFixed(2)})`}
                  </span>
                )}
                {colorForFeature && hazardKind === "deslizamientos" && !props.dominantLevel && (
                  <span style={{ color: "#888" }}>Sin datos del modelo de amenaza</span>
                )}
                {colorForFeature &&
                  hazardKind === "deslizamientos" &&
                  (props.slopeDeg != null ||
                    props.roadDistanceKm != null ||
                    props.faultDistanceKm != null ||
                    props.historyDistanceKm != null ||
                    props.rainfallRatio != null) && (
                    <span style={{ color: "#888" }}>
                      {props.slopeDeg != null && `Pendiente: ${props.slopeDeg.toFixed(1)}°`}
                      {props.slopeDeg != null &&
                        (props.roadDistanceKm != null ||
                          props.faultDistanceKm != null ||
                          props.historyDistanceKm != null ||
                          props.rainfallRatio != null) &&
                        " · "}
                      {props.roadDistanceKm != null && `Vía más cercana: ${props.roadDistanceKm.toFixed(2)} km`}
                      {props.roadDistanceKm != null &&
                        (props.faultDistanceKm != null ||
                          props.historyDistanceKm != null ||
                          props.rainfallRatio != null) &&
                        " · "}
                      {props.faultDistanceKm != null && `Falla más cercana: ${props.faultDistanceKm.toFixed(2)} km`}
                      {props.faultDistanceKm != null &&
                        (props.historyDistanceKm != null || props.rainfallRatio != null) &&
                        " · "}
                      {props.historyDistanceKm != null &&
                        `Movimiento histórico más cercano: ${props.historyDistanceKm.toFixed(2)} km`}
                      {props.historyDistanceKm != null && props.rainfallRatio != null && " · "}
                      {props.rainfallRatio != null && `Lluvia vs. histórico: ${(props.rainfallRatio * 100).toFixed(0)}%`}
                    </span>
                  )}
                {colorForFeature && hazardKind === "inundaciones" && props.floodLevel && (
                  <span>
                    Amenaza por inundación (modelo propio): {props.floodLevel}
                    {props.floodScoreAvg != null && ` (${props.floodScoreAvg.toFixed(2)})`}
                  </span>
                )}
                {colorForFeature && hazardKind === "inundaciones" && !props.floodLevel && (
                  <span style={{ color: "#888" }}>Sin datos del modelo de inundación</span>
                )}
                {colorForFeature &&
                  hazardKind === "inundaciones" &&
                  (props.floodStreamDistanceKm != null || props.slopeDeg != null) && (
                    <span style={{ color: "#888" }}>
                      {props.floodStreamDistanceKm != null &&
                        `Quebrada más cercana: ${props.floodStreamDistanceKm.toFixed(2)} km`}
                      {props.floodStreamDistanceKm != null && props.slopeDeg != null && " · "}
                      {props.slopeDeg != null && `Pendiente: ${props.slopeDeg.toFixed(1)}°`}
                    </span>
                  )}
                {colorForFeature && hazardKind === "inundaciones" && (
                  <span style={{ color: "#888" }}>
                    {props.floodZoningCovered
                      ? `Con zonificación oficial: ${props.floodZoningLevel ?? "—"}`
                      : "Sin zonificación oficial — solo modelo propio"}
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
            </Popup>}
          </Polygon>
        )
      })}
    </>
  )
}
