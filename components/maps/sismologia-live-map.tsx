"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
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
import { Activity, Radio, History, LandPlot, FileWarning } from "lucide-react"
import { VeredaPopupContent } from "@/components/maps/vereda-popup-content"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"
import { summarizeExposureByMunicipio } from "@/lib/veredas/municipio-summary"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { getOsmCategory } from "@/lib/osm/categories"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { maplibreBasemapStyle } from "@/lib/maps/maplibre-basemap-style"
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
import type { SeismicEvent } from "@/lib/sismologia/api-types"
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

function DamageReportsPanel() {
  const { data, isLoading } = useSismologiaDanos(true)

  return (
    <div className="pointer-events-auto absolute right-80 top-3 z-[400] max-h-[60%] w-64 overflow-y-auto rounded-md border border-border bg-card/95 px-3 py-2.5 text-xs shadow-sm backdrop-blur max-sm:right-3 max-sm:bottom-[48%] max-sm:top-auto">
      <p className="mb-1.5 font-medium text-foreground">Reportes de daños — Sevilla</p>
      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {data && (
        <>
          <p className="mb-2 text-muted-foreground">
            {data.totalReportes} reportes comunitarios, sin verificar, agregados por barrio.
          </p>
          <ul className="flex flex-col gap-1.5">
            {data.barrios.map((b) => (
              <li key={b.barrio} className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5 first:border-0 first:pt-0">
                <span className="text-foreground">{b.barrio}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{b.totalReportes}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const mapStyle = useMemo(() => maplibreBasemapStyle(isDark), [isDark])

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
  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [exposureColors, setExposureColors] = useState<Record<SeismicExposureLevel, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")

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
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

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
    return ids
  }, [showVeredas, osmPoints])

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
      setPopupInfo(null)
    },
    [onVeredaSelect],
  )

  const syncBounds = useCallback(() => {
    if (!onBoundsChange) return
    const map = mapRef.current?.getMap()
    const b = map?.getBounds()
    if (!b) return
    onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
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
        onLoad={syncBounds}
        onMoveEnd={syncBounds}
        onZoomEnd={syncBounds}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-left" />
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
            label="Reportes de daños (Sevilla)"
            checked={showDamage}
            onChange={setShowDamage}
          />
        </RailSection>
      </MapControlRail>
      {showDamage && <DamageReportsPanel />}
    </div>
  )
}

// MapLibre touches `window` at module load time, so this component is
// always consumed through a next/dynamic loader with ssr: false.
export default SismologiaLiveMapImpl
