"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  AttributionControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre"
import { setWorkerUrl } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// See deslizamientos-live-map.tsx for why this self-hosted worker override
// is needed under Turbopack.
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}
import { Activity, Radio, History, LandPlot, FileWarning, Route } from "lucide-react"
import { useFaults } from "@/lib/deslizamientos/use-faults"
import { VeredaPopupContent } from "@/components/maps/vereda-popup-content"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"
import { summarizeExposureByMunicipio } from "@/lib/veredas/municipio-summary"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { getOsmCategory } from "@/lib/osm/categories"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { maplibreMapStyle, defaultBasemapForCurrentTheme, type BasemapType } from "@/lib/maps/maplibre-basemap-style"
import { useSismologiaDanos, useSismologiaEventos } from "@/lib/sismologia/use-sismologia"
import {
  SEISMIC_MAGNITUDE_LEVELS,
  SEISMIC_MAGNITUDE_LEVEL_STYLES,
  SEISMIC_EXPOSURE_LEVELS,
  SEISMIC_EXPOSURE_LEVEL_TOKENS,
  type SeismicExposureLevel,
  magnitudeLevel,
  magnitudeRadius,
  seismicExposureLevel,
} from "@/lib/sismologia/levels"
import { DAMAGE_LEVEL_ORDER, DAMAGE_LEVEL_LABEL, DAMAGE_LEVEL_COLOR_TOKEN, type DamageLevel } from "@/lib/sismologia/damage-levels"
import type { SeismicEvent, BarrioDamageSummary, SismologiaDanosResponse } from "@/lib/sismologia/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature, VeredaProperties } from "@/lib/veredas/api-types"

/**
 * MapLibre GL port (see v0_plans/grand-method.md, Phase 3) — follows the
 * deslizamientos spike's patterns. No hazard data/model/API logic changed.
 */

// Same AOI viewport as the other hazard maps — the server-side query bbox (lib/sismologia/server.ts)
// is padded wider than this to catch nearby regional events that still influence exposure.
const AOI_BOUNDS: [[number, number], [number, number]] = [
  [-76.06, 3.88],
  [-75.72, 4.44],
]

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const SOURCE_LABEL: Record<SeismicEvent["source"], string> = {
  "sgc-live": "SGC RSNC (en vivo)",
  usgs: "USGS (en vivo)",
  sgc: "SGC (histórico)",
}

/**
 * Purely-visual time filter for the event markers. It only changes which
 * epicenters are drawn — the per-vereda exposure score and every other
 * metric are computed server-side from the full event set and are never
 * affected by this control.
 */
type TimeWindow = "7" | "14" | "all"
const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "7", label: "Últimos 7 días" },
  { value: "14", label: "Últimos 14 días" },
  { value: "all", label: "Todo el histórico" },
]

/** Distinct marker styling per source: SGC live solid (primary), USGS hollow ring, SGC historical dashed. */
function sourcePaint(source: SeismicEvent["source"], color: string) {
  switch (source) {
    case "sgc-live":
      return { strokeColor: "#ffffff", strokeWidth: 1, fillColor: color, fillOpacity: 0.85 }
    case "usgs":
      return { strokeColor: color, strokeWidth: 2, fillColor: color, fillOpacity: 0.35 }
    case "sgc":
      return { strokeColor: color, strokeWidth: 2, fillColor: color, fillOpacity: 0.15 }
  }
}

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

function MagnitudeLegend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(SEISMIC_MAGNITUDE_LEVELS.map((level) => resolveCssColor(SEISMIC_MAGNITUDE_LEVEL_STYLES[level].colorToken)))
  }, [])

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Magnitud</p>
      <ul className="flex flex-col gap-1">
        {SEISMIC_MAGNITUDE_LEVELS.map((level, i) => (
          <li key={level} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors?.[i] ?? "transparent" }}
              aria-hidden="true"
            />
            {level} <span className="text-muted-foreground/70">({SEISMIC_MAGNITUDE_LEVEL_STYLES[level].range})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Legend for the per-vereda seismic exposure choropleth — the 0–1
 * distance-decay score (lib/sismologia/exposure-score.ts) binned onto the
 * shared 5-tier scale and colored with the sismología ramp. Sits just above
 * the magnitude legend so the two read as one stacked key.
 */
function ExposureLegend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(SEISMIC_EXPOSURE_LEVELS.map((level) => resolveCssColor(SEISMIC_EXPOSURE_LEVEL_TOKENS[level])))
  }, [])

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Exposición sísmica por vereda</p>
      <ul className="flex flex-col gap-1">
        {SEISMIC_EXPOSURE_LEVELS.map((level, i) => (
          <li key={level} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colors?.[i] ?? "transparent" }}
              aria-hidden="true"
            />
            {level}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DamageReportsPanel({
  data,
  isLoading,
}: {
  data: SismologiaDanosResponse | undefined
  isLoading: boolean
}) {
  return (
    <div className="pointer-events-auto absolute right-80 top-3 z-[400] max-h-[60%] w-64 overflow-y-auto rounded-md border border-border bg-card/95 px-3 py-2.5 text-xs shadow-sm backdrop-blur max-sm:right-3 max-sm:bottom-[48%] max-sm:top-auto">
      <p className="mb-1.5 font-medium text-foreground">Reportes de daños — Sevilla</p>
      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {data && (
        <>
          <p className="mb-2 text-muted-foreground">
            {data.totalReportes} reportes comunitarios, sin verificar, agregados por barrio. Las columnas 3D del mapa
            muestran la misma concentración por nivel de daño.
          </p>
          <ul className="flex flex-col gap-2">
            {data.barrios.map((b: BarrioDamageSummary) => (
              <li key={b.barrio} className="flex flex-col gap-1 border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">{b.barrio}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{b.totalReportes}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {DAMAGE_LEVEL_ORDER.filter((level) => b.porNivel[level] > 0).map((level) => (
                    <div key={level} className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: DAMAGE_LEVEL_COLOR_TOKEN[level] }}
                        />
                        {DAMAGE_LEVEL_LABEL[level]}
                      </span>
                      <span className="shrink-0 tabular-nums">{b.porNivel[level]}</span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function DamageLevelLegend() {
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
      {DAMAGE_LEVEL_ORDER.map((level) => (
        <li key={level} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: DAMAGE_LEVEL_COLOR_TOKEN[level] }}
          />
          {DAMAGE_LEVEL_LABEL[level]}
        </li>
      ))}
    </ul>
  )
}

/**
 * Live seismic-activity map with three independently-toggleable, distinctly
 * styled sources: SGC's near-real-time RSNC feed (last 5 días) as the
 * primary live layer — solid filled markers, dense enough to show the small
 * local tremors USGS misses — USGS's FDSN feed (last 90 días) as a hollow
 * confirmation ring, and SGC's historical catalog as a dashed outline. Also
 * offers an optional Sevilla-only community damage-report summary (Survey123,
 * never showing individual points or victim counts — see
 * lib/sismologia/survey-damage.ts) and the shared vereda-boundary overlay
 * for population/infrastructure context.
 */
function SismologiaLiveMapImpl({
  onBoundsChange,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onVeredaSelect?: (feature: VeredaFeature) => void
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const mapRef = useRef<MapRef>(null)

  const { data } = useSismologiaEventos()
  const osmColors = useOsmCategoryColors()
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()
  // Fetched to drive the municipality highlight + risk panel; the shared SWR
  // key dedupes against the vereda fill layer's own fetch below.
  const { veredas } = useVeredas(true)

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!veredas) return []
    return summarizeExposureByMunicipio(veredas).map((s) => ({
      municipio: s.municipio,
      items: [
        { label: "Población", value: s.poblacion != null ? Math.round(s.poblacion).toLocaleString("es-CO") : "—" },
        { label: "Escuelas", value: s.escuelas != null ? `${s.escuelas}` : "—" },
        { label: "Hospitales", value: s.hospitales != null ? `${s.hospitales}` : "—" },
        {
          label: "Infra. crítica",
          value: s.infraestructuraCritica != null ? `${s.infraestructuraCritica}` : "—",
        },
        { label: "Sitios críticos", value: `${s.sitiosCriticos}` },
      ],
    }))
  }, [veredas])

  const [showSgcLive, setShowSgcLive] = useState(true)
  const [showUsgs, setShowUsgs] = useState(true)
  const [showSgc, setShowSgc] = useState(true)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all")
  const [showDamage, setShowDamage] = useState(false)
  const [showVeredas, setShowVeredas] = useState(true)
  const [showFaults, setShowFaults] = useState(false)
  // Drives the faults layer's viewport-growing fetch below — set from the
  // same bounds sync as `onBoundsChange`, but kept local since the layer
  // needs it whether or not a parent is listening.
  const [viewportBounds, setViewportBounds] = useState<MapBounds | null>(null)
  const { traces: faultTraces } = useFaults(showFaults, viewportBounds)
  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [exposureColors, setExposureColors] = useState<Record<SeismicExposureLevel, string> | null>(null)
  const [damageColors, setDamageColors] = useState<Record<DamageLevel, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [faultLineColor, setFaultLineColor] = useState<string | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")
  const { data: damageData, isLoading: isDamageLoading } = useSismologiaDanos(showDamage)
  // Drives the damage-column cluster/detail switch below — matches the
  // AOI's default zoom until the map reports its real one on load.
  const [damageZoom, setDamageZoom] = useState(9)
  const handleZoomChange = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) setDamageZoom(map.getZoom())
  }, [])

  useEffect(() => {
    const entries = SEISMIC_MAGNITUDE_LEVELS.map(
      (level) => [level, resolveCssColor(SEISMIC_MAGNITUDE_LEVEL_STYLES[level].colorToken)] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
    setExposureColors(
      Object.fromEntries(
        SEISMIC_EXPOSURE_LEVELS.map((level) => [level, resolveCssColor(SEISMIC_EXPOSURE_LEVEL_TOKENS[level])] as const),
      ) as Record<SeismicExposureLevel, string>,
    )
    setDamageColors(
      Object.fromEntries(
        DAMAGE_LEVEL_ORDER.map((level) => [level, resolveCssColor(DAMAGE_LEVEL_COLOR_TOKEN[level])] as const),
      ) as Record<DamageLevel, string>,
    )
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
    setFaultLineColor(resolveCssColor("var(--fault-line)"))
  }, [])

  // Shared pitch/bearing toggle: tilts into a 3D perspective (flat 2D
  // fill-extrusion columns are invisible from directly overhead) or eases
  // back to the map's normal top-down view. Also drives the manual
  // MapViewToggle button below.
  const [is3D, setIs3D] = useState(false)
  // Basemap theme, switched independently of the 2D/3D toggle via
  // `MapBasemapControl`. In 3D mode every theme gains real terrain
  // elevation (MapLibre `raster-dem` + `terrain`), since flat 2D tiles have
  // no relief to show once the map is tilted.
  const [basemap, setBasemap] = useState<BasemapType>(defaultBasemapForCurrentTheme)
  const mapStyle = useMemo(() => maplibreMapStyle(basemap, is3D), [basemap, is3D])
  const setMapPitch = useCallback((next: boolean) => {
    const map = mapRef.current?.getMap()
    if (map) map.easeTo(next ? { pitch: 55, bearing: -12, duration: 800 } : { pitch: 0, bearing: 0, duration: 600 })
    setIs3D(next)
  }, [])

  // Defaults into 3D whenever the damage columns are switched on, since
  // they're otherwise invisible from directly overhead; the user can still
  // flip back with the manual toggle.
  useEffect(() => {
    setMapPitch(showDamage)
  }, [showDamage, setMapPitch])

  const visibleEvents = useMemo(() => {
    if (!data) return []
    // Draw order = array order: historical (bottom), USGS, then SGC live on top.
    const list: SeismicEvent[] = []
    if (showSgc) list.push(...data.sgc.events)
    if (showUsgs) list.push(...data.usgs.events)
    if (showSgcLive) list.push(...data.sgcLive.events)
    // Visual-only recency filter; does not touch any score.
    if (timeWindow === "all") return list
    const cutoff = Date.now() - Number(timeWindow) * 86_400_000
    return list.filter((event) => new Date(event.time).getTime() >= cutoff)
  }, [data, showSgcLive, showUsgs, showSgc, timeWindow])

  // Shades each vereda by its 0–1 seismic exposure score (the same
  // distance-decay model that feeds the compound-risk map), mirroring how
  // the deslizamientos and inundaciones maps shade their veredas.
  const veredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredas || !showVeredas || !exposureColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: veredas.features.map((feature) => {
        const active = isMunicipioActive(feature.properties.municipio, activeMunicipios)
        const score = feature.properties.seismicScoreAvg
        const hazardColor = score != null ? exposureColors[seismicExposureLevel(score)] : noDataColor
        return {
          type: "Feature",
          id: feature.id,
          properties: {
            ...feature.properties,
            __fillColor: active ? hazardColor : noDataColor,
            __fillOpacity: active ? 0.6 : 0.12,
            __lineColor: active ? "#ffffff" : noDataColor,
            __lineOpacity: active ? 0.9 : 0.3,
          },
          geometry: {
            type: "MultiPolygon",
            coordinates: feature.geometry.coordinates,
          },
        }
      }),
    }
  }, [veredas, showVeredas, exposureColors, noDataColor, activeMunicipios])

  const eventsGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!resolvedColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: visibleEvents.map((event) => {
        const color = resolvedColors[magnitudeLevel(event.magnitude)]
        const paint = sourcePaint(event.source, color)
        return {
          type: "Feature",
          id: event.id,
          properties: { ...event, __radius: magnitudeRadius(event.magnitude), ...paint },
          geometry: { type: "Point", coordinates: [event.lon, event.lat] },
        }
      }),
    }
  }, [visibleEvents, resolvedColors])

  const faultsGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!faultTraces) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: faultTraces.flatMap((trace) =>
        trace.paths.map((path, i) => ({
          type: "Feature" as const,
          id: `${trace.id}-${i}`,
          properties: { nombre: trace.nombre, tipo: trace.tipo },
          geometry: { type: "LineString" as const, coordinates: path },
        })),
      ),
    }
  }, [faultTraces])

  // Below this zoom every barrio collapses into one Sevilla-wide cluster —
  // the standard point-cluster convention (many bars up close, one
  // aggregate far away) and, since the per-barrio bars are otherwise too
  // small to read against the wider AOI, the only way the zoomed-out view
  // communicates total concentration relative to the land at all.
  const DAMAGE_CLUSTER_ZOOM = 12.5

  // One extruded "bar" per non-zero severity level, laid out side by side
  // around a centroid — a 3D bar chart draped on the map, styled after the
  // ArcGIS field-data extrusion demo.
  const damageColumnsGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!damageData || !damageColors) return { type: "FeatureCollection", features: [] }
    const metersPerDegLat = 111_320

    const squareAround = (lon: number, lat: number, halfSideMeters: number): number[][] => {
      const metersPerDegLon = metersPerDegLat * Math.cos((lat * Math.PI) / 180)
      const dLat = halfSideMeters / metersPerDegLat
      const dLon = halfSideMeters / metersPerDegLon
      return [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ]
    }

    // Lays out one row of bars — one per non-zero severity level, height
    // normalized against `maxCount` — centered on (lat, lon).
    const buildRow = (
      idPrefix: string,
      label: string,
      lat: number,
      lon: number,
      porNivel: Record<DamageLevel, number>,
      maxCount: number,
      opts: { maxHeightMeters: number; minHeightMeters: number; barHalfSideMeters: number; barSpacingMeters: number },
    ): GeoJSON.Feature[] => {
      const metersPerDegLon = metersPerDegLat * Math.cos((lat * Math.PI) / 180)
      const activeLevels = DAMAGE_LEVEL_ORDER.filter((level) => porNivel[level] > 0)
      const rowOffset = ((activeLevels.length - 1) * opts.barSpacingMeters) / 2
      return activeLevels.map((level, i) => {
        const count = porNivel[level]
        const dLon = (i * opts.barSpacingMeters - rowOffset) / metersPerDegLon
        const height = opts.minHeightMeters + (count / maxCount) * (opts.maxHeightMeters - opts.minHeightMeters)
        return {
          type: "Feature",
          id: `${idPrefix}-${level}`,
          properties: {
            barrio: label,
            nivel: level,
            nivelLabel: DAMAGE_LEVEL_LABEL[level],
            count,
            __height: height,
            __color: damageColors[level],
          },
          geometry: { type: "Polygon", coordinates: [squareAround(lon + dLon, lat, opts.barHalfSideMeters)] },
        }
      })
    }

    if (damageZoom < DAMAGE_CLUSTER_ZOOM) {
      const totalPorNivel: Record<DamageLevel, number> = { destruida: 0, danada: 0, posible: 0 }
      let weightedLat = 0
      let weightedLon = 0
      for (const barrio of damageData.barrios) {
        for (const level of DAMAGE_LEVEL_ORDER) totalPorNivel[level] += barrio.porNivel[level]
        weightedLat += barrio.lat * barrio.totalReportes
        weightedLon += barrio.lon * barrio.totalReportes
      }
      if (damageData.totalReportes > 0) {
        weightedLat /= damageData.totalReportes
        weightedLon /= damageData.totalReportes
      }
      const maxCount = Math.max(1, ...DAMAGE_LEVEL_ORDER.map((l) => totalPorNivel[l]))
      return {
        type: "FeatureCollection",
        features: buildRow("sevilla-total", "Sevilla (todos los barrios)", weightedLat, weightedLon, totalPorNivel, maxCount, {
          maxHeightMeters: 900,
          minHeightMeters: 60,
          barHalfSideMeters: 55,
          barSpacingMeters: 160,
        }),
      }
    }

    const maxCount = Math.max(1, ...damageData.barrios.flatMap((b) => DAMAGE_LEVEL_ORDER.map((l) => b.porNivel[l])))
    return {
      type: "FeatureCollection",
      features: damageData.barrios.flatMap((barrio) =>
        buildRow(barrio.barrio, barrio.barrio, barrio.lat, barrio.lon, barrio.porNivel, maxCount, {
          maxHeightMeters: 420,
          minHeightMeters: 24,
          barHalfSideMeters: 14,
          barSpacingMeters: 42,
        }),
      ),
    }
  }, [damageData, damageColors, damageZoom])

  const osmGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!osmPoints || !osmColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: osmPoints.map((p) => ({
        type: "Feature",
        id: p.id,
        properties: { ...p, __color: osmColors[p.category] },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    }
  }, [osmPoints, osmColors])

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = []
    if (showVeredas) ids.push("veredas-fill")
    ids.push("seismic-events")
    if (osmPoints && osmPoints.length > 0) ids.push("osm-points")
    if (showFaults) ids.push("faults-hit")
    if (showDamage) ids.push("damage-columns")
    return ids
  }, [showVeredas, osmPoints, showFaults, showDamage])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const { lng, lat } = e.lngLat
      const eventFeature = e.features?.find((f) => f.layer.id === "seismic-events")
      if (eventFeature) {
        const props = eventFeature.properties as unknown as SeismicEvent
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>M {props.magnitude.toFixed(1)}</strong>
              <span>{props.place ?? "Catálogo histórico SGC"}</span>
              <span>{formatDateTime(props.time)}</span>
              {props.depthKm != null && <span>Profundidad: {props.depthKm.toFixed(1)} km</span>}
              <span>Fuente: {SOURCE_LABEL[props.source]}</span>
              {props.source === "sgc-live" && props.reviewStatus && (
                <span>Revisión: {props.reviewStatus === "manual" ? "manual (analista)" : "automática"}</span>
              )}
            </div>
          ),
        })
        return
      }
      const osmFeature = e.features?.find((f) => f.layer.id === "osm-points")
      if (osmFeature) {
        const props = osmFeature.properties as unknown as OsmPoint
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{props.name ?? getOsmCategory(props.category).label}</strong>
              <span>{getOsmCategory(props.category).label}</span>
            </div>
          ),
        })
        return
      }
      const veredaFeature = e.features?.find((f) => f.layer.id === "veredas-fill")
      if (veredaFeature) {
        const props = veredaFeature.properties as unknown as VeredaProperties
        const feature = { properties: props } as VeredaFeature
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: <VeredaPopupContent feature={feature} hazardKind="sismologia" colored />,
        })
        onVeredaSelect?.(feature)
        return
      }
      const damageFeature = e.features?.find((f) => f.layer.id === "damage-columns")
      if (damageFeature) {
        const props = damageFeature.properties as unknown as {
          barrio: string
          nivelLabel: string
          count: number
        }
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{props.barrio}</strong>
              <span>{props.nivelLabel}</span>
              <span>
                {props.count} {props.count === 1 ? "reporte" : "reportes"}
              </span>
              <span style={{ color: "#888" }}>Reporte comunitario, sin verificar (Sevilla)</span>
            </div>
          ),
        })
        return
      }
      const faultFeature = e.features?.find((f) => f.layer.id === "faults-hit")
      if (faultFeature) {
        const props = faultFeature.properties as { nombre: string | null; tipo: string | null }
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{props.nombre ?? "Falla sin nombre"}</strong>
              <span>{props.tipo ?? "Tipo no especificado"}</span>
              <span style={{ color: "#888" }}>Servicio Geológico Colombiano (SGC)</span>
            </div>
          ),
        })
        return
      }
      setPopupInfo(null)
    },
    [onVeredaSelect],
  )

  const syncBounds = useCallback(() => {
    const map = mapRef.current?.getMap()
    const b = map?.getBounds()
    if (!b) return
    const bounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
    setViewportBounds(bounds)
    onBoundsChange?.(bounds)
  }, [onBoundsChange])

  const isFirstMunicipioRender = useRef(true)
  const previousMunicipioKey = useRef(activeMunicipios.join("|"))
  useEffect(() => {
    const key = activeMunicipios.join("|")
    if (isFirstMunicipioRender.current) {
      isFirstMunicipioRender.current = false
      previousMunicipioKey.current = key
      return
    }
    if (key === previousMunicipioKey.current) return
    previousMunicipioKey.current = key

    const bounds = boundsForActiveMunicipios(veredas, activeMunicipios) as
      | [[number, number], [number, number]]
      | null
    if (!bounds) return
    const map = mapRef.current?.getMap()
    if (!map) return
    const [[south, west], [north, east]] = bounds
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 48, duration: 900, maxZoom: 14 },
    )
  }, [veredas, activeMunicipios])

  return (
    <div
      className={
        className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"
      }
    >
      <Map
        ref={mapRef}
        initialViewState={{ bounds: AOI_BOUNDS }}
        minZoom={7}
        maxZoom={16}
        mapStyle={mapStyle}
        attributionControl={false}
        cursor={cursor}
        interactiveLayerIds={interactiveLayerIds}
        onLoad={() => {
          syncBounds()
          handleZoomChange()
        }}
        onMoveEnd={syncBounds}
        onZoomEnd={syncBounds}
        onZoom={handleZoomChange}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-left" />
        <MapViewToggleControl is3D={is3D} onToggle={() => setMapPitch(!is3D)} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} />
  <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />

        {showVeredas && (
          <Source id="veredas-source" type="geojson" data={veredasGeoJson}>
            <Layer
              id="veredas-fill"
              type="fill"
              paint={{ "fill-color": ["get", "__fillColor"], "fill-opacity": ["get", "__fillOpacity"] }}
            />
            <Layer
              id="veredas-line"
              type="line"
              paint={{ "line-color": ["get", "__lineColor"], "line-opacity": ["get", "__lineOpacity"], "line-width": 1 }}
            />
          </Source>
        )}

        {resolvedColors && (
          <Source id="seismic-events-source" type="geojson" data={eventsGeoJson}>
            <Layer
              id="seismic-events"
              type="circle"
              paint={{
                "circle-radius": ["get", "__radius"],
                "circle-color": ["get", "fillColor"],
                "circle-opacity": ["get", "fillOpacity"],
                "circle-stroke-color": ["get", "strokeColor"],
                "circle-stroke-width": ["get", "strokeWidth"],
              }}
            />
          </Source>
        )}

        {osmPoints && osmPoints.length > 0 && (
          <Source id="osm-source" type="geojson" data={osmGeoJson}>
            <Layer
              id="osm-points"
              type="circle"
              paint={{
                "circle-radius": 5,
                "circle-color": ["get", "__color"],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
                "circle-opacity": 0.9,
              }}
            />
          </Source>
        )}

        {showFaults && (
          <Source id="faults-source" type="geojson" data={faultsGeoJson}>
            <Layer
              id="faults-line"
              type="line"
              paint={{ "line-color": faultLineColor ?? "#888", "line-width": 2, "line-dasharray": [6, 4] }}
            />
            {/*
             * A thin dashed line's clickable area is only ~1px wide, so
             * clicks land on the vereda polygon underneath almost every
             * time. This invisible, much wider companion layer carries the
             * actual click interaction (registered via `interactiveLayerIds`
             * above) while the thin dashed layer stays purely decorative.
             */}
            <Layer
              id="faults-hit"
              type="line"
              paint={{ "line-color": faultLineColor ?? "#888", "line-width": 18, "line-opacity": 0 }}
            />
          </Source>
        )}

        {showDamage && damageColors && (
          <Source id="damage-columns-source" type="geojson" data={damageColumnsGeoJson}>
            <Layer
              id="damage-columns"
              type="fill-extrusion"
              paint={{
                "fill-extrusion-height": ["get", "__height"],
                "fill-extrusion-base": 0,
                "fill-extrusion-color": ["get", "__color"],
                "fill-extrusion-opacity": 0.88,
              }}
            />
          </Source>
        )}

        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            anchor="bottom"
          >
            {popupInfo.content}
          </Popup>
        )}
      </Map>

      <MapControlRail>
        <RailSection title="Municipios" first>
          <MunicipioTogglePanelContent
            active={activeMunicipiosMap}
            onToggle={toggleMunicipio}
            summaries={municipioSummaries}
            riskTitle="Exposición por municipio"
          />
        </RailSection>

        <RailSection title="Eventos sísmicos">
          <RailToggleRow icon={Radio} label="SGC en vivo (5 días)" checked={showSgcLive} onChange={setShowSgcLive} />
          <RailToggleRow icon={Activity} label="USGS en vivo (90 días)" checked={showUsgs} onChange={setShowUsgs} />
          <RailToggleRow icon={History} label="SGC histórico" checked={showSgc} onChange={setShowSgc} />
        </RailSection>

        <RailSection title="Ventana temporal (solo visual)">
          <div className="flex flex-col gap-1">
            {TIME_WINDOWS.map((w) => (
              <label key={w.value} className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="radio"
                  name="sismo-time-window"
                  checked={timeWindow === w.value}
                  onChange={() => setTimeWindow(w.value)}
                  className="size-3.5 accent-primary"
                />
                {w.label}
              </label>
            ))}
          </div>
        </RailSection>

        <RailSection title="Magnitud">
          <MagnitudeLegend />
        </RailSection>

        <RailSection title="Capas">
          <RailToggleRow icon={LandPlot} label="Límites veredales" checked={showVeredas} onChange={setShowVeredas} />
          {showVeredas && <ExposureLegend />}
          <RailToggleRow
            icon={FileWarning}
            label="Reportes de daños (Sevilla) — 3D"
            checked={showDamage}
            onChange={setShowDamage}
          />
          {showDamage && <DamageLevelLegend />}
        </RailSection>

        <RailSection title="Referencia oficial (SGC)">
          <RailToggleRow icon={Route} label="Fallas geológicas" checked={showFaults} onChange={setShowFaults} />
        </RailSection>
      </MapControlRail>
      {showDamage && <DamageReportsPanel data={damageData} isLoading={isDamageLoading} />}
    </div>
  )
}

// MapLibre touches `window` at module load time, so this component is
// always consumed through a next/dynamic loader with ssr: false.
export default SismologiaLiveMapImpl
