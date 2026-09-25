import { floodSusceptibilityColorToken } from "@/lib/inundaciones/levels"
import { fireLevelColorToken } from "@/lib/incendios/levels"
import { seismicExposureColorToken, seismicExposureLevel } from "@/lib/sismologia/levels"
import type { VeredaFeature } from "@/lib/veredas/api-types"

export type VeredaPopupHazardKind = "deslizamientos" | "inundaciones" | "sismologia" | "incendios"

interface VeredaPopupContentProps {
  feature: VeredaFeature
  /** Which hazard model's fields to show alongside the shared population/infrastructure summary. */
  hazardKind?: VeredaPopupHazardKind
  /**
   * Whether the host map colors this vereda by `hazardKind`'s model (shows
   * that model's fields) or renders it as a plain outline (shared summary
   * only) — mirrors `VeredasOverlay`'s `colorForFeature` being present.
   */
  colored?: boolean
}

/**
 * Plain-React popup body shared by every vereda click across both map
 * renderers: the Leaflet `VeredasOverlay` (via its `<Popup>`) and the
 * MapLibre `deslizamientos-live-map` spike (via `react-map-gl`'s
 * `<Popup>`). Both libraries just mount arbitrary React children as popup
 * content, so this single component is renderer-agnostic — extracted out
 * of `VeredasOverlay` to avoid duplicating the same ~100 lines of
 * per-hazard-model field rendering in the MapLibre rewrite.
 */
export function VeredaPopupContent({ feature, hazardKind = "deslizamientos", colored }: VeredaPopupContentProps) {
  const props = feature.properties

  return (
    <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
      <strong>{props.nombre}</strong>
      <span>{props.municipio}</span>
      {colored && hazardKind === "deslizamientos" && props.dominantLevel && (
        <span>
          Amenaza (modelo propio): {props.dominantLevel}
          {props.isScoreAvg != null && ` (${props.isScoreAvg.toFixed(2)})`}
        </span>
      )}
      {colored && hazardKind === "deslizamientos" && !props.dominantLevel && (
        <span style={{ color: "#888" }}>Sin datos del modelo de amenaza</span>
      )}
      {colored &&
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
              (props.faultDistanceKm != null || props.historyDistanceKm != null || props.rainfallRatio != null) &&
              " · "}
            {props.faultDistanceKm != null && `Falla más cercana: ${props.faultDistanceKm.toFixed(2)} km`}
            {props.faultDistanceKm != null && (props.historyDistanceKm != null || props.rainfallRatio != null) && " · "}
            {props.historyDistanceKm != null &&
              `Movimiento histórico más cercano: ${props.historyDistanceKm.toFixed(2)} km`}
            {props.historyDistanceKm != null && props.rainfallRatio != null && " · "}
            {props.rainfallRatio != null && `Lluvia vs. histórico: ${(props.rainfallRatio * 100).toFixed(0)}%`}
          </span>
        )}
      {colored && hazardKind === "inundaciones" && props.floodLevel && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              flexShrink: 0,
              backgroundColor: floodSusceptibilityColorToken(props.floodLevel),
            }}
          />
          Nivel de alerta (modelo propio): {props.floodLevel}
          {props.floodScoreAvg != null && ` (${props.floodScoreAvg.toFixed(2)})`}
        </span>
      )}
      {colored && hazardKind === "inundaciones" && !props.floodLevel && (
        <span style={{ color: "#888" }}>Sin datos del modelo de inundación</span>
      )}
      {colored && hazardKind === "inundaciones" && (props.floodStreamDistanceKm != null || props.slopeDeg != null) && (
        <span style={{ color: "#888" }}>
          {props.floodStreamDistanceKm != null && `Quebrada más cercana: ${props.floodStreamDistanceKm.toFixed(2)} km`}
          {props.floodStreamDistanceKm != null && props.slopeDeg != null && " · "}
          {props.slopeDeg != null && `Pendiente: ${props.slopeDeg.toFixed(1)}°`}
        </span>
      )}
      {colored && hazardKind === "inundaciones" && (
        <span style={{ color: "#888" }}>
          {props.floodZoningCovered
            ? `Con zonificación oficial: ${props.floodZoningLevel ?? "—"}`
            : "Sin zonificación oficial — solo modelo propio"}
        </span>
      )}
      {colored && hazardKind === "incendios" && props.fireLevel && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              flexShrink: 0,
              backgroundColor: fireLevelColorToken(props.fireLevel),
            }}
          />
          Amenaza de incendio (modelo propio): {props.fireLevel}
          {props.fireScoreAvg != null && ` (${props.fireScoreAvg.toFixed(2)})`}
        </span>
      )}
      {colored && hazardKind === "incendios" && !props.fireLevel && (
        <span style={{ color: "#888" }}>Sin datos del modelo de incendio</span>
      )}
      {colored &&
        hazardKind === "incendios" &&
        (props.slopeDeg != null ||
          props.roadDistanceKm != null ||
          props.fireHistoryCount != null ||
          props.fireFwi != null) && (
          <span style={{ color: "#888" }}>
            {props.slopeDeg != null && `Pendiente: ${props.slopeDeg.toFixed(1)}°`}
            {props.slopeDeg != null &&
              (props.roadDistanceKm != null || props.fireHistoryCount != null || props.fireFwi != null) &&
              " · "}
            {props.roadDistanceKm != null && `Vía más cercana: ${props.roadDistanceKm.toFixed(2)} km`}
            {props.roadDistanceKm != null && (props.fireHistoryCount != null || props.fireFwi != null) && " · "}
            {props.fireHistoryCount != null && `Focos históricos cercanos: ${props.fireHistoryCount}`}
            {props.fireHistoryCount != null && props.fireFwi != null && " · "}
            {props.fireFwi != null && `FWI hoy: ${props.fireFwi.toFixed(1)}`}
          </span>
        )}
      {colored && hazardKind === "sismologia" && props.seismicScoreAvg != null && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              flexShrink: 0,
              backgroundColor: seismicExposureColorToken(props.seismicScoreAvg),
            }}
          />
          Exposición sísmica (modelo propio): {seismicExposureLevel(props.seismicScoreAvg)} (
          {props.seismicScoreAvg.toFixed(2)})
        </span>
      )}
      {colored && hazardKind === "sismologia" && props.seismicNearestEventKm != null && (
        <span style={{ color: "#888" }}>
          Epicentro más cercano: {props.seismicNearestEventKm.toFixed(1)} km
          {props.seismicNearestMagnitude != null && ` · M ${props.seismicNearestMagnitude.toFixed(1)}`}
        </span>
      )}
      <span>Población estimada: {props.poblacion != null ? Math.round(props.poblacion).toLocaleString("es-CO") : "—"}</span>
      <span>
        Escuelas: {props.escuelas ?? "—"} · Hospitales: {props.hospitales ?? "—"} · Farmacias: {props.farmacias ?? "—"}
      </span>
      <span>Infraestructura crítica: {props.infraestructuraCritica ?? "—"}</span>
      <span>Sitios críticos (2019): {props.sitiosCriticos}</span>
    </div>
  )
}
