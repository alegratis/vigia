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

// Turbopack rewrites maplibre-gl's internal `import.meta.url`-based worker
// resolution into a blob URL, which breaks the worker's own relative asset
// resolution. Pointing at a self-hosted copy of the worker script sidesteps
// that bundler-specific failure mode.
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}
import { Loader2, Droplets, AlertTriangle, History, Trees, Building2, ShieldCheck } from "lucide-react"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { SUSCEPTIBILITY_LEVELS, SUSCEPTIBILITY_LEVEL_STYLES, levelColorToken } from "@/lib/deslizamientos/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { SMAP_TILE_URL, SMAP_COLOR_STOPS, SMAP_MAX_VALUE } from "@/lib/deslizamientos/smap"
import { GWIS_WMS_URL } from "@/lib/incendios/gwis"
import { GWIS_LANDCOVER_LAYER, GWIS_LANDCOVER_LEGEND_URL } from "@/lib/land-cover/gwis-landcover"
import {
  GWIS_SETTLEMENT_LAYER,
  GWIS_SETTLEMENT_LEGEND_URL,
  GWIS_PROTECTED_AREAS_LAYER,
  GWIS_PROTECTED_AREAS_LEGEND_URL,
} from "@/lib/demografia/gwis-context-layers"
import { maplibreMapStyle, defaultBasemapForCurrentTheme, type BasemapType } from "@/lib/maps/maplibre-basemap-style"
import { wmsRasterSource } from "@/lib/maps/wms-raster-source"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { WmsLegendChip } from "@/components/maps/wms-legend-chip"
import { useCriticalSites } from "@/lib/deslizamientos/use-critical-sites"
import {
  CRITICAL_SITE_SEVERITIES,
  CRITICAL_SITE_SEVERITY_STYLES,
  tipoLabel,
} from "@/lib/deslizamientos/critical-sites-types"
import { useLandslideInventory } from "@/lib/deslizamientos/use-landslide-inventory"
import { VeredaPopupContent } from "@/components/maps/vereda-popup-content"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { summarizeByMunicipio } from "@/lib/veredas/municipio-summary"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"
import type { VeredaFeature, VeredaProperties } from "@/lib/veredas/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

/**
 * MapLibre GL spike: this is the first map ported off Leaflet/react-leaflet
 * (see v0_plans/grand-method.md, Phase 3) — driven by upcoming 3D map
 * graphs (at-risk population, socio-demographics, calculated risk) that
 * Leaflet has no path to but MapLibre's `fill-extrusion`/terrain support
 * does. Every other hazard map stays on Leaflet until this one is
 * reviewed. No hazard data/model/API logic changed — purely a
 * rendering-layer swap, same default export/props as before so
 * `deslizamientos-live-map-loader.tsx` needs no changes.
 */

// MapLibre bounds are `[[west, south], [east, north]]` — the same AOI
// framing the Leaflet version used ([[south,west],[north,east]] there),
// reordered for `initialViewState.bounds`.
const AOI_BOUNDS: [[number, number], [number, number]] = [
  [-76.06, 3.88],
  [-75.72, 4.44],
]

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

/** Susceptibility color-scale rows, rendered inside the shared MapControlRail. */
function SusceptibilityLegendList() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(SUSCEPTIBILITY_LEVELS.map((level) => resolveCssColor(levelColorToken(level))))
  }, [])

  return (
    <ul className="flex flex-col gap-1">
      {SUSCEPTIBILITY_LEVELS.map((level, i) => (
        <li key={level} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: colors?.[i] ?? "transparent" }}
            aria-hidden="true"
          />
          {level}
        </li>
      ))}
    </ul>
  )
}

/**
 * Legend for the "Cobertura del suelo" overlay — GWIS/EFFIS's own
 * GetLegendGraphic image, rendered on a fixed white chip since it's not
 * theme-aware. Shared with the fire map, see components/maps/wms-legend-chip.tsx.
 */
function LandCoverLegend() {
  return (
    <WmsLegendChip
      src={GWIS_LANDCOVER_LEGEND_URL}
      alt="Escala de cobertura del suelo (MODIS MCD12Q1)"
    />
  )
}

function SettlementLegend() {
  return (
    <WmsLegendChip
      src={GWIS_SETTLEMENT_LEGEND_URL}
      alt="Leyenda de asentamientos humanos (GHSL Built-Up)"
    />
  )
}

function ProtectedAreasLegend() {
  return (
    <WmsLegendChip
      src={GWIS_PROTECTED_AREAS_LEGEND_URL}
      alt="Leyenda de áreas protegidas (WDPA)"
    />
  )
}

/**
 * Legend for the "Sitios críticos" overlay's severity scale (`SEVERIDAD`,
 * 1–4), shown only while the layer is toggled on, inside the shared rail's
 * "Leyenda activa" section.
 */
function CriticalSitesLegend() {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-foreground">Sitios críticos — severidad</p>
      <ul className="flex flex-col gap-1">
        {Object.values(CRITICAL_SITE_SEVERITY_STYLES).map((style) => (
          <li key={style.code} className="flex items-center gap-2 text-muted-foreground">
            <span
              className={`size-2.5 shrink-0 rounded-full ${style.swatchClass}`}
              aria-hidden="true"
            />
            {style.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Legend for the SMAP root-zone soil moisture overlay: a gradient bar built
 * from `SMAP_COLOR_STOPS` (GIBS's own published colormap), so it reproduces
 * NASA Worldview's legend instead of linking out to it. Shown only while
 * the layer is toggled on, inside the shared rail's "Leyenda activa" section.
 */
function SoilMoistureLegend() {
  const gradient = SMAP_COLOR_STOPS.map(
    (stop) => `${stop.rgb} ${((stop.value / SMAP_MAX_VALUE) * 100).toFixed(1)}%`,
  ).join(", ")

  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-foreground">Humedad del suelo (SMAP)</p>
      <div
        className="h-2.5 w-full rounded-sm"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
        aria-hidden="true"
      />
      <div className="mt-1 flex items-center justify-between text-muted-foreground">
        <span>Seco</span>
        <span>Saturado</span>
      </div>
      <p className="mt-1 text-muted-foreground">0.00 – ≥0.70 m³/m³ · NASA GIBS</p>
    </div>
  )
}

/**
 * Live landslide hazard map: shades each vereda (~55 across Sevilla,
 * Caicedonia and Zarzal) by this app's own hazard model — slope + road
 * proximity + a rainfall-anomaly trigger, computed at its centroid (see
 * lib/deslizamientos/hazard-model.ts) — rather than RED LabOT's discontinued
 * `VIGIA_Amenaza_IS_Puntos` point grid, which only ever covered Sevilla and
 * Caicedonia. Optionally overlaid with NASA GIBS's SMAP root-zone soil
 * moisture. Click a vereda for its hazard level and the model's underlying
 * factors.
 */
function DeslizamientosLiveMapImpl({
  onBoundsChange,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  /** Bubbles up the vereda clicked on the map, so a panel below can drill into its own hazard-model factors. */
  onVeredaSelect?: (feature: VeredaFeature) => void
  /** OSM infrastructure points for the categories currently toggled on. */
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const mapRef = useRef<MapRef>(null)

  const [is3D, setIs3D] = useState(false)
  const [basemap, setBasemap] = useState<BasemapType>(defaultBasemapForCurrentTheme)
  const mapStyle = useMemo(() => maplibreMapStyle(basemap, is3D), [basemap, is3D])
 const setMapPitch = useCallback((next: boolean) => {
    const map = mapRef.current?.getMap()
    if (map) map.easeTo(next ? { pitch: 55, bearing: -12, duration: 800 } : { pitch: 0, bearing: 0, duration: 600 })
    setIs3D(next)
  }, [])

  const osmColors = useOsmCategoryColors()
  // Always enabled now that vereda shading is this map's primary layer, not
  // an opt-in overlay.
  const { veredas, error: veredasError, isLoading: veredasLoading } = useVeredas(true)
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!veredas) return []
    return summarizeByMunicipio(veredas).map((s) => ({
      municipio: s.municipio,
      items: SUSCEPTIBILITY_LEVELS.filter((level) => s.levelCounts[level] > 0).map((level) => ({
        label: level,
        value: `${s.levelCounts[level]}`,
        colorToken: levelColorToken(level),
      })),
    }))
  }, [veredas])

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [showSoilMoisture, setShowSoilMoisture] = useState(false)
  const [showCriticalSites, setShowCriticalSites] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showLandCover, setShowLandCover] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  const { points: criticalSites } = useCriticalSites(showCriticalSites)
  const { records: historyRecords } = useLandslideInventory(showHistory)
  const [historyColor, setHistoryColor] = useState<string | null>(null)
  const [criticalSiteColors, setCriticalSiteColors] = useState<Record<number, string> | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")

  useEffect(() => {
    const entries = SUSCEPTIBILITY_LEVELS.map(
      (level) => [level, resolveCssColor(levelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
    setHistoryColor(resolveCssColor("var(--historical-event)"))
    setCriticalSiteColors(
      Object.fromEntries(
        CRITICAL_SITE_SEVERITIES.map((severity) => [
          severity,
          resolveCssColor(CRITICAL_SITE_SEVERITY_STYLES[severity].colorToken),
        ]),
      ),
    )
  }, [])

  const colorForLevel = useCallback(
    (level: string | undefined) => (level && resolvedColors?.[level]) || "var(--muted-foreground)",
    [resolvedColors],
  )

  // GeoJSON source for the vereda choropleth — each feature carries a
  // precomputed `__fillColor`/`__dimmed` style, since MapLibre paint
  // expressions can only read feature properties, not call arbitrary JS.
  const veredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredas || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: veredas.features.map((feature) => {
        const active = isMunicipioActive(feature.properties.municipio, activeMunicipios)
        const level = feature.properties.dominantLevel
        const hazardColor = level ? colorForLevel(level) : noDataColor
        return {
          type: "Feature",
          id: feature.id,
          properties: {
            ...feature.properties,
            __fillColor: active ? hazardColor : noDataColor,
            __fillOpacity: active ? 0.6 : 0.12,
            __lineColor: active ? "#ffffff" : noDataColor,
            __lineOpacity: active ? 0.9 : 0.3,
            __lineWidth: 1,
          },
          geometry: {
            type: "MultiPolygon",
            coordinates: feature.geometry.coordinates,
          },
        }
      }),
    }
  }, [veredas, activeMunicipios, colorForLevel, noDataColor])

  const criticalSitesGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!criticalSites || !criticalSiteColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: criticalSites.map((site) => ({
        type: "Feature" as const,
        id: site.id,
        properties: { ...site, __color: criticalSiteColors[site.severidad] ?? noDataColor ?? "#888" },
        geometry: { type: "Point" as const, coordinates: [site.lon, site.lat] },
      })),
    }
  }, [criticalSites, criticalSiteColors, noDataColor])

  const historyGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!historyRecords || !historyColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: historyRecords.map((record) => ({
        type: "Feature" as const,
        id: record.id,
        properties: { ...record, __color: historyColor },
        geometry: { type: "Point" as const, coordinates: [record.lon, record.lat] },
      })),
    }
  }, [historyRecords, historyColor])

  const osmGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!osmPoints || !osmColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: osmPoints.map((p) => ({
        type: "Feature" as const,
        id: p.id,
        properties: { ...p, __color: osmColors[p.category] },
        geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      })),
    }
  }, [osmPoints, osmColors])

  const landCoverSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_LANDCOVER_LAYER), [])
  const settlementSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_SETTLEMENT_LAYER), [])
  const protectedAreasSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_PROTECTED_AREAS_LAYER), [])

  const interactiveLayerIds = useMemo(() => {
    const ids = ["veredas-fill"]
    if (showCriticalSites) ids.push("critical-sites")
    if (showHistory) ids.push("history-points")
    if (osmPoints && osmPoints.length > 0) ids.push("osm-points")
    return ids
  }, [showCriticalSites, showHistory, osmPoints])

  const hoveredVeredaId = useRef<string | number | null>(null)

  const clearVeredaHover = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map && hoveredVeredaId.current != null) {
      map.setFeatureState({ source: "veredas-source", id: hoveredVeredaId.current }, { hover: false })
    }
    hoveredVeredaId.current = null
  }, [])

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const veredaFeature = e.features?.find((f) => f.layer.id === "veredas-fill")
      const map = mapRef.current?.getMap()
      if (!map) return
      if (veredaFeature?.id === hoveredVeredaId.current) return
      clearVeredaHover()
      if (veredaFeature?.id != null) {
        map.setFeatureState({ source: "veredas-source", id: veredaFeature.id }, { hover: true })
        hoveredVeredaId.current = veredaFeature.id
      }
    },
    [clearVeredaHover],
  )

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) {
        setPopupInfo(null)
        return
      }
      const { lng, lat } = e.lngLat
      if (feature.layer.id === "veredas-fill") {
        const props = feature.properties as unknown as VeredaProperties
        const veredaFeature = { properties: props } as VeredaFeature
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: <VeredaPopupContent feature={veredaFeature} hazardKind="deslizamientos" colored />,
        })
        onVeredaSelect?.(veredaFeature)
        return
      }
      if (feature.layer.id === "critical-sites") {
        const props = feature.properties as {
          tipo: number
          municipio: string
          severidad: 1 | 2 | 3 | 4
          observaciones: string | null
          fecha: string | null
        }
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{tipoLabel(props.tipo)}</strong>
              <span>{props.municipio}</span>
              <span>{CRITICAL_SITE_SEVERITY_STYLES[props.severidad]?.label ?? "—"}</span>
              {props.observaciones && <span>{props.observaciones}</span>}
              {props.fecha && <span style={{ color: "#888" }}>Registrado: {props.fecha}</span>}
            </div>
          ),
        })
        return
      }
      if (feature.layer.id === "history-points") {
        const props = feature.properties as { tipo: string | null; subtipo: string | null }
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{props.tipo ?? "Movimiento sin tipo"}</strong>
              <span>{props.subtipo ?? "Subtipo no especificado"}</span>
              <span style={{ color: "#888" }}>
                Inventario de movimientos en masa, Servicio Geológico Colombiano (SGC) — sin fecha registrada
              </span>
            </div>
          ),
        })
        return
      }
      if (feature.layer.id === "osm-points") {
        const props = feature.properties as OsmPoint
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

  // Flies the map to frame whichever municipios are toggled on in the
  // rail's "Municipios" section — skips the first render (the map already
  // opens framed on the full AOI via `initialViewState.bounds`) and skips
  // an "every municipio active" selection.
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
    <div className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <Map
        ref={mapRef}
        initialViewState={{ bounds: AOI_BOUNDS }}
        minZoom={9}
        maxZoom={16}
        mapStyle={mapStyle}
        attributionControl={false}
        cursor={cursor}
        interactiveLayerIds={interactiveLayerIds}
        onLoad={syncBounds}
        onMoveEnd={syncBounds}
        onZoomEnd={syncBounds}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => {
          setCursor("")
          clearVeredaHover()
        }}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        {/*
         * MapControlRail docks the full right edge (top-3 to bottom-3), so
         * top-right/bottom-right controls would render underneath it. Both
         * live on the left edge instead — the only corners the rail never
         * occupies, on desktop or its mobile bottom-sheet layout.
         */}
        <NavigationControl position="top-left" />
        <MapViewToggleControl is3D={is3D} onToggle={() => setMapPitch(!is3D)} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} />
        <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />

        {showSoilMoisture && (
          <Source id="soil-moisture" type="raster" tiles={[SMAP_TILE_URL]} tileSize={256} maxzoom={6}>
            <Layer id="soil-moisture" type="raster" paint={{ "raster-opacity": 0.6 }} />
          </Source>
        )}
        {showLandCover && (
          <Source id="land-cover-source" type="raster" tiles={landCoverSource.tiles} tileSize={landCoverSource.tileSize}>
            <Layer id="land-cover" type="raster" paint={{ "raster-opacity": 0.55 }} />
          </Source>
        )}
        {showSettlement && (
          <Source
            id="settlement-source"
            type="raster"
            tiles={settlementSource.tiles}
            tileSize={settlementSource.tileSize}
          >
            <Layer id="settlement" type="raster" paint={{ "raster-opacity": 0.7 }} />
          </Source>
        )}
        {showProtectedAreas && (
          <Source
            id="protected-areas-source"
            type="raster"
            tiles={protectedAreasSource.tiles}
            tileSize={protectedAreasSource.tileSize}
          >
            <Layer id="protected-areas" type="raster" paint={{ "raster-opacity": 0.6 }} />
          </Source>
        )}

        <Source id="veredas-source" type="geojson" data={veredasGeoJson}>
          <Layer
            id="veredas-fill"
            type="fill"
            paint={{ "fill-color": ["get", "__fillColor"], "fill-opacity": ["get", "__fillOpacity"] }}
          />
          <Layer
            id="veredas-line"
            type="line"
            paint={{
              "line-color": ["get", "__lineColor"],
              "line-opacity": ["get", "__lineOpacity"],
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                ["+", ["get", "__lineWidth"], 1.5],
                ["get", "__lineWidth"],
              ],
            }}
          />
        </Source>

        {showCriticalSites && (
          <Source id="critical-sites-source" type="geojson" data={criticalSitesGeoJson}>
            <Layer
              id="critical-sites"
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

        {showHistory && (
          <Source id="history-source" type="geojson" data={historyGeoJson}>
            <Layer
              id="history-points"
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
      {veredasLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      {veredasError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <span className="text-sm text-destructive">No se pudo cargar la capa.</span>
        </div>
      )}
      <MapControlRail>
        <RailSection title="Municipios" first>
          <MunicipioTogglePanelContent
            active={activeMunicipiosMap}
            onToggle={toggleMunicipio}
            summaries={municipioSummaries}
            riskTitle="Susceptibilidad a deslizamiento (veredas por nivel)"
          />
        </RailSection>
        <RailSection title="Susceptibilidad a deslizamiento">
          <SusceptibilityLegendList />
        </RailSection>
        <RailSection title="Datos satelitales">
          <RailToggleRow
            icon={Droplets}
            label="Humedad del suelo (SMAP)"
            checked={showSoilMoisture}
            onChange={setShowSoilMoisture}
          />
        </RailSection>
        <RailSection title="Referencia oficial (SGC)">
          <div className="flex flex-col gap-0.5">
            <RailToggleRow
              icon={AlertTriangle}
              label="Sitios críticos (2019)"
              checked={showCriticalSites}
              onChange={setShowCriticalSites}
            />
            <RailToggleRow
              icon={History}
              label="Movimientos en masa históricos"
              checked={showHistory}
              onChange={setShowHistory}
            />
          </div>
        </RailSection>
        <RailSection title="Cobertura y contexto">
          <div className="flex flex-col gap-0.5">
            <RailToggleRow
              icon={Trees}
              label="Cobertura del suelo (MODIS)"
              checked={showLandCover}
              onChange={setShowLandCover}
            />
            <RailToggleRow
              icon={Building2}
              label="Asentamientos humanos (GHSL)"
              checked={showSettlement}
              onChange={setShowSettlement}
            />
            <RailToggleRow
              icon={ShieldCheck}
              label="Áreas protegidas (WDPA)"
              checked={showProtectedAreas}
              onChange={setShowProtectedAreas}
            />
          </div>
        </RailSection>
        {(showCriticalSites ||
          showSoilMoisture ||
          showLandCover ||
          showSettlement ||
          showProtectedAreas ||
          (osmPoints && osmPoints.length > 0)) && (
          <RailSection title="Leyenda activa">
            <div className="flex flex-col gap-3">
              {showSoilMoisture && <SoilMoistureLegend />}
              {showCriticalSites && <CriticalSitesLegend />}
              {showLandCover && <LandCoverLegend />}
              {showSettlement && <SettlementLegend />}
              {showProtectedAreas && <ProtectedAreasLegend />}
              {osmPoints && osmPoints.length > 0 && <OsmLegend points={osmPoints} bare />}
            </div>
          </RailSection>
        )}
      </MapControlRail>
    </div>
  )
}

// MapLibre (like Leaflet) touches `window` at module load time, so this
// component is always consumed through DeslizamientosLiveMapLoader
// (next/dynamic, ssr: false).
export default DeslizamientosLiveMapImpl
