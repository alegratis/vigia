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
import useSWR from "swr"
import { CloudSun, Flame, Satellite, Trees, Building2, ShieldCheck, Mountain } from "lucide-react"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { FIRE_THREAT_LEVELS, FIRE_THREAT_LEVEL_STYLES, fireLevelColorToken } from "@/lib/incendios/levels"
import {
  forecastDayOptions,
  GWIS_FWI_LAYER,
  GWIS_LEGEND_URL,
  GWIS_S3_HOTSPOT_LAYER,
  GWIS_S3_HOTSPOT_LEGEND_URL,
  GWIS_WMS_URL,
} from "@/lib/incendios/gwis"
import { GWIS_LANDCOVER_LAYER, GWIS_LANDCOVER_LEGEND_URL } from "@/lib/land-cover/gwis-landcover"
import {
  GWIS_SETTLEMENT_LAYER,
  GWIS_SETTLEMENT_LEGEND_URL,
  GWIS_PROTECTED_AREAS_LAYER,
  GWIS_PROTECTED_AREAS_LEGEND_URL,
} from "@/lib/demografia/gwis-context-layers"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { CONFIDENCE_STYLES, formatDateTime, formatDistance, formatFrp } from "@/lib/firms/ui"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { summarizeByMunicipio } from "@/lib/veredas/municipio-summary"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"
import { maplibreMapStyle, defaultBasemapForCurrentTheme, type BasemapType } from "@/lib/maps/maplibre-basemap-style"
import { wmsRasterSource } from "@/lib/maps/wms-raster-source"
import { WmsLegendChip } from "@/components/maps/wms-legend-chip"
import type { FireDetection, FiresResponse } from "@/lib/firms/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature, VeredaProperties } from "@/lib/veredas/api-types"

/**
 * MapLibre GL port (see v0_plans/grand-method.md, Phase 3) — follows the
 * deslizamientos spike's patterns. No hazard data/model/API logic changed.
 */

const AOI_BOUNDS_ML: [[number, number], [number, number]] = [
  [-76.06, 3.88],
  [-75.72, 4.44],
]

const FIRE_DAY_OPTIONS = [1, 2, 3, 5] as const

const firesFetcher = async (url: string): Promise<FiresResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar los focos activos de NASA FIRMS")
  return res.json()
}

/** Scale a marker's radius (px) by its Fire Radiative Power so hotter fires stand out. */
function fireRadius(frp: number): number {
  return Math.min(11, Math.max(4, 4 + Math.sqrt(frp) / 2))
}

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

/** Fire-threat color-scale rows, rendered inside the shared MapControlRail. */
function ThreatLegendList() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(FIRE_THREAT_LEVELS.map((level) => resolveCssColor(fireLevelColorToken(level))))
  }, [])

  return (
    <ul className="flex flex-col gap-1">
      {FIRE_THREAT_LEVELS.map((level, i) => (
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

function FwiLegend() {
  return <WmsLegendChip src={GWIS_LEGEND_URL} alt="Escala del Índice Meteorológico de Incendio (FWI)" />
}

function FireLegend({ colors }: { colors: Record<FireDetection["confidence"], string> | null }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-foreground">Focos activos (MODIS / VIIRS)</p>
      <ul className="flex flex-col gap-1">
        {(Object.keys(CONFIDENCE_STYLES) as FireDetection["confidence"][]).map((key) => (
          <li key={key} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full border border-white/60"
              style={{ backgroundColor: colors?.[key] ?? "transparent" }}
              aria-hidden="true"
            />
            {CONFIDENCE_STYLES[key].label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function S3Legend() {
  return (
    <WmsLegendChip
      src={GWIS_S3_HOTSPOT_LEGEND_URL}
      alt="Escala de antigüedad de los focos activos Sentinel-3"
      className="block max-h-40"
    />
  )
}

function LandCoverLegend() {
  return <WmsLegendChip src={GWIS_LANDCOVER_LEGEND_URL} alt="Escala de cobertura del suelo (MODIS MCD12Q1)" />
}

function SettlementLegend() {
  return <WmsLegendChip src={GWIS_SETTLEMENT_LEGEND_URL} alt="Leyenda de asentamientos humanos (GHSL Built-Up)" />
}

function ProtectedAreasLegend() {
  return <WmsLegendChip src={GWIS_PROTECTED_AREAS_LEGEND_URL} alt="Leyenda de áreas protegidas (WDPA)" />
}

/**
 * Live forest-fire threat map: colors every vereda by this app's own
 * forest-fire hazard model, always on and covering all three municipios.
 * Optional overlays add GWIS/Copernicus EFFIS's Fire Weather Index (FWI)
 * forecast and active fires by sensor (MODIS and VIIRS as NASA FIRMS
 * points, Sentinel-3 as a GWIS WMS raster tile). Click a vereda for its
 * detail, narrowing the shared sidebar's population card and the
 * FireModelPanel down to it.
 */
function IncendiosLiveMapImpl({
  onBoundsChange,
  onZoneSelect,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  /** Called with the clicked vereda's feature when "Modelo propio de incendios forestales" is on, or `null` to clear the selection (see FireModelPanel's "Ver todo"). */
  onVeredaSelect?: (feature: VeredaFeature | null) => void
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
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()
  const { veredas } = useVeredas(true)

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!veredas) return []
    return summarizeByMunicipio(veredas).map((s) => ({
      municipio: s.municipio,
      items: FIRE_THREAT_LEVELS.filter((level) => s.fireLevelCounts[level] > 0).map((level) => ({
        label: level,
        value: `${s.fireLevelCounts[level]}`,
        colorToken: fireLevelColorToken(level),
      })),
    }))
  }, [veredas])

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [showForecast, setShowForecast] = useState(true)
  const dayOptions = useMemo(() => forecastDayOptions(), [])
  const [selectedDay, setSelectedDay] = useState(dayOptions[0].value)
  const [showModis, setShowModis] = useState(true)
  const [showViirs, setShowViirs] = useState(true)
  const [showSentinel3, setShowSentinel3] = useState(true)
  const [showFireModel, setShowFireModel] = useState(true)
  const [showLandCover, setShowLandCover] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  const [fireDays, setFireDays] = useState<number>(2)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")
  const needsFirms = showModis || showViirs
  const { data: firesData } = useSWR<FiresResponse>(
    needsFirms ? `/api/incendios?days=${fireDays}` : null,
    firesFetcher,
    { revalidateOnFocus: false },
  )
  const [fireColors, setFireColors] = useState<Record<FireDetection["confidence"], string> | null>(null)

  const visibleFires = useMemo(
    () => firesData?.detections.filter((d) => (d.sensor === "modis" ? showModis : showViirs)) ?? [],
    [firesData, showModis, showViirs],
  )

  useEffect(() => {
    const entries = FIRE_THREAT_LEVELS.map((level) => [level, resolveCssColor(fireLevelColorToken(level))] as const)
    setResolvedColors(Object.fromEntries(entries))
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  useEffect(() => {
    const entries = (Object.keys(CONFIDENCE_STYLES) as FireDetection["confidence"][]).map(
      (key) => [key, resolveCssColor(CONFIDENCE_STYLES[key].color)] as const,
    )
    setFireColors(Object.fromEntries(entries) as Record<FireDetection["confidence"], string>)
  }, [])

  const veredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredas || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: veredas.features.map((feature) => {
        const active = isMunicipioActive(feature.properties.municipio, activeMunicipios)
        const level = feature.properties.fireLevel
        const hazardColor = (level && resolvedColors[level]) || noDataColor
        return {
          type: "Feature",
          id: feature.id,
          properties: {
            ...feature.properties,
            __fillColor: active ? hazardColor : noDataColor,
            __fillOpacity: active ? 0.55 : 0.12,
            __lineColor: active ? "#ffffff" : noDataColor,
            __lineOpacity: active ? 0.85 : 0.3,
          },
          geometry: { type: "MultiPolygon", coordinates: feature.geometry.coordinates },
        }
      }),
    }
  }, [veredas, activeMunicipios, resolvedColors, noDataColor])

  const firesGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!fireColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: visibleFires.map((d) => ({
        type: "Feature",
        id: d.id,
        properties: { ...d, __color: fireColors[d.confidence], __radius: fireRadius(d.frp) },
        geometry: { type: "Point", coordinates: [d.lon, d.lat] },
      })),
    }
  }, [visibleFires, fireColors])

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

  const forecastSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_FWI_LAYER, { TIME: selectedDay }), [selectedDay])
  const landCoverSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_LANDCOVER_LAYER), [])
  const settlementSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_SETTLEMENT_LAYER), [])
  const protectedAreasSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_PROTECTED_AREAS_LAYER), [])
  const sentinel3Source = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_S3_HOTSPOT_LAYER), [])

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = []
    if (showFireModel) ids.push("veredas-fill")
    if (fireColors && visibleFires.length > 0) ids.push("fires")
    if (osmPoints && osmPoints.length > 0) ids.push("osm-points")
    return ids
  }, [showFireModel, fireColors, visibleFires, osmPoints])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const { lng, lat } = e.lngLat
      // Active fire/OSM markers are small circles that sit on top of the vereda
      // polygon visually, but a precise single-point hit test often misses them
      // while still landing inside the (much larger) polygon underneath. Query a
      // small pixel box around the click first so these point layers always win
      // over the vereda fill when the click is anywhere near a marker.
      const map = mapRef.current?.getMap()
      const tolerance = 6
      const bbox: [[number, number], [number, number]] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance],
      ]
      const fireFeature =
        map && map.getLayer("fires")
          ? map.queryRenderedFeatures(bbox, { layers: ["fires"] })[0]
          : e.features?.find((f) => f.layer.id === "fires")
      if (fireFeature) {
        const props = fireFeature.properties as unknown as FireDetection
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{formatDateTime(props.acquiredAt)}</strong>
              <span>
                Cerca de {props.nearest.name} · {formatDistance(props.nearest.distanceKm)}
              </span>
              <span>Confianza: {CONFIDENCE_STYLES[props.confidence].label}</span>
              <span>FRP: {formatFrp(props.frp)}</span>
              <span>Satélite: {props.satellite}</span>
            </div>
          ),
        })
        return
      }
      const osmFeature =
        map && map.getLayer("osm-points")
          ? map.queryRenderedFeatures(bbox, { layers: ["osm-points"] })[0]
          : e.features?.find((f) => f.layer.id === "osm-points")
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
        onVeredaSelect?.({ properties: props } as VeredaFeature)
        setPopupInfo(null)
        return
      }
      setPopupInfo(null)
      onVeredaSelect?.(null)
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

  void onZoneSelect

  return (
    <div className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <Map
        ref={mapRef}
        initialViewState={{ bounds: AOI_BOUNDS_ML }}
        minZoom={9}
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
        <MapViewToggleControl is3D={is3D} onToggle={() => setMapPitch(!is3D)} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} />
  <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />

        {showForecast && (
          <Source id="forecast-source" type="raster" tiles={forecastSource.tiles} tileSize={forecastSource.tileSize}>
            <Layer id="forecast" type="raster" paint={{ "raster-opacity": 0.55 }} />
          </Source>
        )}
        {showLandCover && (
          <Source id="land-cover-source" type="raster" tiles={landCoverSource.tiles} tileSize={landCoverSource.tileSize}>
            <Layer id="land-cover" type="raster" paint={{ "raster-opacity": 0.55 }} />
          </Source>
        )}
        {showSettlement && (
          <Source id="settlement-source" type="raster" tiles={settlementSource.tiles} tileSize={settlementSource.tileSize}>
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

        {showFireModel && (
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

        {showSentinel3 && (
          <Source id="sentinel3-source" type="raster" tiles={sentinel3Source.tiles} tileSize={sentinel3Source.tileSize}>
            <Layer id="sentinel3" type="raster" paint={{ "raster-opacity": 0.85 }} />
          </Source>
        )}

        {fireColors && visibleFires.length > 0 && (
          <Source id="fires-source" type="geojson" data={firesGeoJson}>
            <Layer
              id="fires"
              type="circle"
              paint={{
                "circle-radius": ["get", "__radius"],
                "circle-color": ["get", "__color"],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
                "circle-opacity": 0.85,
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
            riskTitle="Amenaza de incendio (modelo propio, veredas por nivel)"
          />
        </RailSection>

        {showFireModel && (
          <RailSection title="Amenaza por incendios forestales (modelo propio, por vereda)">
            <ThreatLegendList />
          </RailSection>
        )}

        <RailSection title="Pronóstico y focos activos">
          <RailToggleRow
            icon={CloudSun}
            label="Pronóstico FWI (ECMWF / GWIS)"
            checked={showForecast}
            onChange={setShowForecast}
          />
          {showForecast && (
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="ml-5 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {dayOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          )}
          {showForecast && <FwiLegend />}
          <RailToggleRow icon={Flame} label="MODIS" checked={showModis} onChange={setShowModis} />
          <RailToggleRow icon={Flame} label="VIIRS (todas)" checked={showViirs} onChange={setShowViirs} />
          <RailToggleRow icon={Satellite} label="Sentinel-3" checked={showSentinel3} onChange={setShowSentinel3} />
          {needsFirms && (
            <label className="ml-5 flex items-center gap-1.5 text-muted-foreground">
              Periodo
              <select
                value={fireDays}
                onChange={(e) => setFireDays(Number(e.target.value))}
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {FIRE_DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? "día" : "días"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {needsFirms && <FireLegend colors={fireColors} />}
          {showSentinel3 && <S3Legend />}
        </RailSection>

        <RailSection title="Cobertura y contexto">
          <RailToggleRow
            icon={Trees}
            label="Cobertura del suelo (MODIS)"
            checked={showLandCover}
            onChange={setShowLandCover}
          />
          {showLandCover && <LandCoverLegend />}
          <RailToggleRow
            icon={Building2}
            label="Asentamientos humanos (GHSL)"
            checked={showSettlement}
            onChange={setShowSettlement}
          />
          {showSettlement && <SettlementLegend />}
          <RailToggleRow
            icon={ShieldCheck}
            label="Áreas protegidas (WDPA)"
            checked={showProtectedAreas}
            onChange={setShowProtectedAreas}
          />
          {showProtectedAreas && <ProtectedAreasLegend />}
        </RailSection>

        <RailSection title="Modelo de amenaza">
          <RailToggleRow
            icon={Mountain}
            label="Modelo propio de incendios forestales"
            checked={showFireModel}
            onChange={setShowFireModel}
          />
        </RailSection>

        {osmPoints && osmPoints.length > 0 && (
          <RailSection title="Infraestructura (OSM)">
            <OsmLegend points={osmPoints} bare />
          </RailSection>
        )}
      </MapControlRail>
    </div>
  )
}

// MapLibre touches `window` at module load time, so this component is
// always consumed through IncendiosLiveMapLoader (next/dynamic, ssr: false).
export default IncendiosLiveMapImpl
