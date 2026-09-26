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
import useSWR from "swr"
import {
  ExternalLink,
  Loader2,
  Waves,
  CloudRain,
  LandPlot,
  GitBranch,
  Building2,
  ShieldCheck,
} from "lucide-react"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import {
  AOI_BOUNDS,
  buildExportUrl,
  identifyReach,
  returnPeriodColor,
  returnPeriodLabel,
  type LatLngBounds,
  type ReachInfo,
} from "@/lib/geoglows/live-map"
import { STATIONS, type Station } from "@/lib/geoglows/stations"
import { StationDetailDialog } from "@/components/flood/station-detail-dialog"
import { FLOOD_SUSCEPTIBILITY_LEVELS, floodSusceptibilityColorToken } from "@/lib/inundaciones/levels"
import { IMERG_TILE_URL, IMERG_WORLDVIEW_URL } from "@/lib/precipitacion/imerg"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { formatFlow } from "@/lib/flood-ui"
import { nearestPoint, type MapBounds } from "@/lib/map-bounds"
import { REFERENCE_POINTS } from "@/lib/firms/area"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { summarizeByMunicipio } from "@/lib/veredas/municipio-summary"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"
import { maplibreBasemapStyle } from "@/lib/maps/maplibre-basemap-style"
import { wmsRasterSource } from "@/lib/maps/wms-raster-source"
import { WmsLegendChip } from "@/components/maps/wms-legend-chip"
import { GWIS_WMS_URL } from "@/lib/incendios/gwis"
import {
  GWIS_SETTLEMENT_LAYER,
  GWIS_SETTLEMENT_LEGEND_URL,
  GWIS_PROTECTED_AREAS_LAYER,
  GWIS_PROTECTED_AREAS_LEGEND_URL,
} from "@/lib/demografia/gwis-context-layers"
import type {
  InundacionesQuebradasResponse,
  InundacionesSusceptibilidadResponse,
} from "@/lib/inundaciones/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { VeredaFeature, VeredaProperties } from "@/lib/veredas/api-types"

/**
 * MapLibre GL port (see v0_plans/grand-method.md, Phase 3) — follows the
 * deslizamientos spike's patterns exactly: native GeoJSON sources/layers in
 * place of `VeredasOverlay`/react-leaflet vector layers, a MapLibre `image`
 * source in place of Leaflet's `ImageOverlay` for the GEOGLOWS reach
 * raster, and a single `onClick` priority chain in place of Leaflet's
 * per-layer `eventHandlers` + `L.DomEvent.stopPropagation`. No hazard
 * data/model/API logic changed.
 */

const AOI_BOUNDS_ML: [[number, number], [number, number]] = [
  [AOI_BOUNDS.west, AOI_BOUNDS.south],
  [AOI_BOUNDS.east, AOI_BOUNDS.north],
]

/**
 * Names singled out for a thicker, brighter line and their own popup
 * emphasis — Río Totoro (GEOGLOWS rivid 610330643) and Quebrada San José,
 * both specifically asked about when this layer was added.
 */
const HIGHLIGHTED_STREAM_NAMES = ["Río Totoro", "Quebrada San José"]

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

function ReturnPeriodLegend() {
  const [colors, setColors] = useState<string[] | null>(null)
  const legend = [
    { value: 0, label: "Normal", token: "var(--chart-2)" },
    { value: 2, label: "Supera 2 años", token: "var(--chart-3)" },
    { value: 10, label: "Supera 10 años", token: "var(--chart-4)" },
    { value: 25, label: "Supera 25 años", token: "var(--chart-4)" },
    { value: 50, label: "Supera 50 años", token: "var(--chart-5)" },
  ]

  useEffect(() => {
    setColors(legend.map((l) => resolveCssColor(l.token)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-foreground">Periodo de retorno (río, en vivo)</p>
      <ul className="flex flex-col gap-1">
        {legend.map((l, i) => (
          <li key={l.value} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors?.[i] ?? "transparent" }}
              aria-hidden="true"
            />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Legend for the flood hazard color scale — shared by the official zoning
 * layer and this app's own vereda-level flood model (see
 * lib/inundaciones/hazard-model.ts).
 */
function SusceptibilityLegend({ title }: { title: string }) {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(
      FLOOD_SUSCEPTIBILITY_LEVELS.map((level) => resolveCssColor(floodSusceptibilityColorToken(level))),
    )
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-foreground">{title}</p>
      <ul className="flex flex-col gap-1">
        {FLOOD_SUSCEPTIBILITY_LEVELS.map((level, i) => (
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
    </div>
  )
}

function SettlementLegend() {
  return <WmsLegendChip src={GWIS_SETTLEMENT_LEGEND_URL} alt="Leyenda de asentamientos humanos (GHSL Built-Up)" />
}

function ProtectedAreasLegend() {
  return <WmsLegendChip src={GWIS_PROTECTED_AREAS_LEGEND_URL} alt="Leyenda de áreas protegidas (WDPA)" />
}

const susceptibilityFetcher = async (url: string): Promise<InundacionesSusceptibilidadResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de susceptibilidad a inundaciones")
  return res.json()
}

const quebradasFetcher = async (url: string): Promise<InundacionesQuebradasResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de quebradas y ríos")
  return res.json()
}

/**
 * Live GEOGLOWS flood map: renders their published ArcGIS Living Atlas
 * "GlobalWaterModel_Medium" layer over the basemap, centered on the study
 * area, plus the static flood-susceptibility zoning and vereda boundaries
 * colored by this app's own flood hazard model, as toggleable layers
 * underneath. This app's own model is the default-on layer; click any
 * reach for its live GEOGLOWS forecast attributes, any susceptibility zone
 * for its official threat level, or a vereda boundary to narrow the shared
 * sidebar's population card to it.
 *
 * Click priority (in place of Leaflet's per-layer `stopPropagation`):
 * susceptibility zone / quebrada / station / OSM point clicks each own the
 * click and never trigger a GEOGLOWS reach lookup underneath. A vereda
 * click narrows the sidebar (like the other hazard maps) but — since
 * GEOGLOWS' identify endpoint answers for literally any lat/lng, unlike a
 * vector feature — still *also* falls through to the reach lookup when
 * "Consultar río al hacer clic" is on, matching the Leaflet version's
 * `blockMapClick={false}` behavior. A vereda click never opens its own
 * popup here; its summary surfaces through the sidebar narrowing instead,
 * same accepted simplification as the deslizamientos spike.
 */
function GeoglowsLiveMapImpl({
  onBoundsChange,
  onZoneSelect,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  /** Called with the clicked vereda's feature when "Límites veredales" is on. */
  onVeredaSelect?: (feature: VeredaFeature) => void
  /** OSM infrastructure points for the categories currently toggled on. */
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const mapRef = useRef<MapRef>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const mapStyle = useMemo(() => maplibreBasemapStyle(isDark), [isDark])

  const [is3D, setIs3D] = useState(false)
  const setMapPitch = useCallback((next: boolean) => {
    const map = mapRef.current?.getMap()
    if (map) map.easeTo(next ? { pitch: 55, bearing: -12, duration: 800 } : { pitch: 0, bearing: 0, duration: 600 })
    setIs3D(next)
  }, [])

  const [overlay, setOverlay] = useState<{ bounds: LatLngBounds; width: number; height: number } | null>(null)
  const [showSusceptibility, setShowSusceptibility] = useState(false)
  const [showPrecipitation, setShowPrecipitation] = useState(false)
  const [showVeredas, setShowVeredas] = useState(true)
  const [showQuebradas, setShowQuebradas] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  // Off by default — see module doc: GEOGLOWS' identify endpoint answers
  // for any lat/lng, so leaving this always-on would mean every click
  // (vereda/quebrada included) also fires a reach lookup.
  const [queryReachOnClick, setQueryReachOnClick] = useState(false)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")
  const osmColors = useOsmCategoryColors()
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()
  const { veredas } = useVeredas(true)

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!veredas) return []
    return summarizeByMunicipio(veredas).map((s) => ({
      municipio: s.municipio,
      items: FLOOD_SUSCEPTIBILITY_LEVELS.filter((level) => s.floodLevelCounts[level] > 0).map((level) => ({
        label: level,
        value: `${s.floodLevelCounts[level]}`,
        colorToken: floodSusceptibilityColorToken(level),
      })),
    }))
  }, [veredas])

  const { data: susceptibility, error: susceptibilityError } = useSWR<InundacionesSusceptibilidadResponse>(
    "/api/inundaciones/susceptibilidad",
    susceptibilityFetcher,
    { revalidateOnFocus: false },
  )

  const { data: quebradas, error: quebradasError } = useSWR<InundacionesQuebradasResponse>(
    showQuebradas ? "/api/inundaciones/quebradas" : null,
    quebradasFetcher,
    { revalidateOnFocus: false },
  )

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  useEffect(() => {
    const entries = FLOOD_SUSCEPTIBILITY_LEVELS.map(
      (level) => [level, resolveCssColor(floodSusceptibilityColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  const veredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredas || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: veredas.features.map((feature) => {
        const active = isMunicipioActive(feature.properties.municipio, activeMunicipios)
        const level = feature.properties.floodLevel
        const hazardColor = (level && resolvedColors[level]) || noDataColor
        return {
          type: "Feature",
          id: feature.id,
          properties: {
            ...feature.properties,
            __fillColor: active ? hazardColor : noDataColor,
            __fillOpacity: active ? 0.5 : 0.1,
            __lineColor: active ? "#ffffff" : noDataColor,
            __lineOpacity: active ? 0.8 : 0.25,
          },
          geometry: { type: "MultiPolygon", coordinates: feature.geometry.coordinates },
        }
      }),
    }
  }, [veredas, activeMunicipios, resolvedColors, noDataColor])

  const susceptibilityGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!susceptibility?.polygons || !resolvedColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: susceptibility.polygons.features.map((feature, i) => {
        const nivel = feature.properties?.descripcio as string | undefined
        const color = (nivel && resolvedColors[nivel]) || noDataColor || "#888"
        return {
          type: "Feature",
          id: `susceptibilidad-${i}`,
          properties: { ...feature.properties, __color: color },
          geometry: feature.geometry,
        }
      }),
    } as GeoJSON.FeatureCollection
  }, [susceptibility, resolvedColors, noDataColor])

  const quebradasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!quebradas?.lines) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: quebradas.lines.features.map((feature, i) => ({
        type: "Feature",
        id: `quebrada-${i}`,
        properties: feature.properties,
        geometry: feature.geometry,
      })),
    } as GeoJSON.FeatureCollection
  }, [quebradas])

  const stationsGeoJson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: STATIONS.map((s) => ({
        type: "Feature",
        id: s.slug,
        properties: { slug: s.slug },
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      })),
    }),
    [],
  )

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

  const settlementSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_SETTLEMENT_LAYER), [])
  const protectedAreasSource = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_PROTECTED_AREAS_LAYER), [])

  const overlayUrl = useMemo(() => {
    if (!overlay) return null
    return buildExportUrl(overlay.bounds, overlay.width, overlay.height)
  }, [overlay])

  const reachImageCoordinates = useMemo<[[number, number], [number, number], [number, number], [number, number]] | null>(() => {
    if (!overlay) return null
    const { north, south, east, west } = overlay.bounds
    return [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ]
  }, [overlay])

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = []
    if (showSusceptibility) ids.push("susceptibility-fill")
    if (showQuebradas) ids.push("quebradas-hit")
    ids.push("stations")
    if (osmPoints && osmPoints.length > 0) ids.push("osm-points")
    if (showVeredas) ids.push("veredas-fill")
    return ids
  }, [showSusceptibility, showQuebradas, osmPoints, showVeredas])

  const runReachIdentify = useCallback(
    async (lng: number, lat: number) => {
      const map = mapRef.current?.getMap()
      if (!map) return
      const b = map.getBounds()
      const size = map.getCanvas()
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        content: (
          <div className="flex min-w-48 flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Consultando GEOGLOWS…
            </span>
          </div>
        ),
      })
      let info: ReachInfo | null = null
      let error: "no-reach" | "network" | null = null
      try {
        info = await identifyReach(
          lat,
          lng,
          { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
          size.width,
          size.height,
        )
        if (!info) error = "no-reach"
      } catch {
        error = "network"
      }
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        content: (
          <div className="flex min-w-48 flex-col gap-1.5 text-sm">
            {error === "no-reach" && <span className="text-muted-foreground">Sin tramo de río en este punto.</span>}
            {error === "network" && <span className="text-destructive">No se pudo consultar el servicio.</span>}
            {info && (
              <>
                <span className="flex items-center gap-2 font-semibold">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: returnPeriodColor(info.returnPeriod) }}
                    aria-hidden="true"
                  />
                  {returnPeriodLabel(info.returnPeriod)}
                </span>
                {info.meanFlowCms != null && <span>Caudal medio: {formatFlow(info.meanFlowCms)}</span>}
                {info.strahlerOrder != null && (
                  <span className="text-muted-foreground">Orden de Strahler: {info.strahlerOrder}</span>
                )}
                {info.forecastTimestamp && (
                  <span className="text-xs text-muted-foreground">Pronóstico: {info.forecastTimestamp}</span>
                )}
                <span className="text-xs text-muted-foreground">Fuente: GEOGLOWS / Esri Living Atlas</span>
              </>
            )}
          </div>
        ),
      })
    },
    [],
  )

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const { lng, lat } = e.lngLat
      const susceptibilityFeature = e.features?.find((f) => f.layer.id === "susceptibility-fill")
      if (susceptibilityFeature) {
        const nivel = susceptibilityFeature.properties?.descripcio as string | undefined
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>Susceptibilidad a inundación</strong>
              <span>{nivel ?? "—"}</span>
            </div>
          ),
        })
        const nearest = nearestPoint(lat, lng, REFERENCE_POINTS)
        if (nearest) onZoneSelect?.(nearest.name)
        return
      }
      const quebradaFeature = e.features?.find((f) => f.layer.id === "quebradas-hit")
      if (quebradaFeature) {
        const nombre = quebradaFeature.properties?.nombre as string | undefined
        const source = quebradaFeature.properties?.source as string | undefined
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{nombre ?? "Quebrada / río"}</strong>
              <span>{source === "osm" ? "Fuente: OpenStreetMap" : "Fuente: capa Quebradas (ArcGIS)"}</span>
            </div>
          ),
        })
        return
      }
      const stationFeature = e.features?.find((f) => f.layer.id === "stations")
      if (stationFeature) {
        const slug = stationFeature.properties?.slug as string
        const station = STATIONS.find((s) => s.slug === slug)
        if (station) {
          setPopupInfo({
            longitude: lng,
            latitude: lat,
            content: (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">{station.name}</span>
                <span className="text-muted-foreground">{station.municipality}</span>
                <button
                  type="button"
                  onClick={() => setSelectedStation(station)}
                  className="mt-1 text-left text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ver hidrograma completo →
                </button>
              </div>
            ),
          })
        }
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
        onVeredaSelect?.({ properties: props } as VeredaFeature)
        // Falls through: GEOGLOWS' identify endpoint answers for any
        // lat/lng, so a vereda click still runs the reach lookup below
        // when enabled — same as the Leaflet version's `blockMapClick={false}`.
      }
      if (queryReachOnClick) {
        runReachIdentify(lng, lat)
      } else if (!veredaFeature) {
        setPopupInfo(null)
      }
    },
    [onZoneSelect, onVeredaSelect, queryReachOnClick, runReachIdentify],
  )

  const syncBounds = useCallback(() => {
    const map = mapRef.current?.getMap()
    const b = map?.getBounds()
    const canvas = map?.getCanvas()
    if (!b || !canvas) return
    const bounds: LatLngBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }
    setOverlay({ bounds, width: canvas.width, height: canvas.height })
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
    <div className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <Map
        ref={mapRef}
        initialViewState={{ bounds: AOI_BOUNDS_ML }}
        minZoom={6}
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
  <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />

        {showSusceptibility && (
          <Source id="susceptibility-source" type="geojson" data={susceptibilityGeoJson}>
            <Layer
              id="susceptibility-fill"
              type="fill"
              paint={{ "fill-color": ["get", "__color"], "fill-opacity": 0.45, "fill-outline-color": ["get", "__color"] }}
            />
          </Source>
        )}

        {showPrecipitation && (
          <Source id="precipitation-source" type="raster" tiles={[IMERG_TILE_URL]} tileSize={256} maxzoom={6}>
            <Layer id="precipitation" type="raster" paint={{ "raster-opacity": 0.6 }} />
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

        {showQuebradas && (
          <Source id="quebradas-source" type="geojson" data={quebradasGeoJson}>
            <Layer
              id="quebradas-line"
              type="line"
              paint={{
                "line-color": ["match", ["get", "nombre"], HIGHLIGHTED_STREAM_NAMES, "#38bdf8", "#0ea5e9"],
                "line-width": ["match", ["get", "nombre"], HIGHLIGHTED_STREAM_NAMES, 4, 2],
                "line-opacity": ["match", ["get", "nombre"], HIGHLIGHTED_STREAM_NAMES, 1, 0.75],
              }}
            />
            {/* Wider invisible companion carries the click hit-target, same trick as the fault lines in the landslide map. */}
            <Layer id="quebradas-hit" type="line" paint={{ "line-color": "#0ea5e9", "line-width": 14, "line-opacity": 0 }} />
          </Source>
        )}

        {reachImageCoordinates && overlayUrl && (
          <Source id="reach-image-source" type="image" url={overlayUrl} coordinates={reachImageCoordinates}>
            <Layer id="reach-image" type="raster" paint={{ "raster-opacity": 0.9 }} />
          </Source>
        )}

        <Source id="stations-source" type="geojson" data={stationsGeoJson}>
          <Layer
            id="stations"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": "#ffffff",
              "circle-stroke-color": "#1e3a8a",
              "circle-stroke-width": 2,
            }}
          />
        </Source>

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

      {((showSusceptibility && !susceptibility && !susceptibilityError) ||
        (showQuebradas && !quebradas && !quebradasError)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      <MapControlRail>
        <RailSection title="Municipios" first>
          <MunicipioTogglePanelContent
            active={activeMunicipiosMap}
            onToggle={toggleMunicipio}
            summaries={municipioSummaries}
            riskTitle="Amenaza a inundación (modelo propio, veredas por nivel)"
          />
        </RailSection>

        <RailSection title="Río (en vivo)">
          <RailToggleRow
            icon={Waves}
            label="Consultar río al hacer clic (GEOGLOWS)"
            checked={queryReachOnClick}
            onChange={setQueryReachOnClick}
          />
        </RailSection>

        <RailSection title="Capas">
          <RailToggleRow
            icon={ShieldCheck}
            label="Susceptibilidad a inundación"
            checked={showSusceptibility}
            onChange={setShowSusceptibility}
          />
          <RailToggleRow
            icon={CloudRain}
            label="Precipitación (IMERG)"
            checked={showPrecipitation}
            onChange={setShowPrecipitation}
          />
          {showPrecipitation && (
            <a
              href={IMERG_WORLDVIEW_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 pl-6 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver escala en Worldview
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
          <RailToggleRow
            icon={LandPlot}
            label="Modelo propio de inundación (por vereda, incluye Zarzal)"
            checked={showVeredas}
            onChange={setShowVeredas}
          />
          <RailToggleRow
            icon={GitBranch}
            label="Quebradas y ríos (clic para nombre)"
            checked={showQuebradas}
            onChange={setShowQuebradas}
          />
        </RailSection>

        <RailSection title="Infraestructura (OSM)">
          <OsmLegend points={osmPoints ?? []} bare />
        </RailSection>

        <RailSection title="Cobertura y contexto">
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
        </RailSection>

        {(showSusceptibility || showVeredas || showSettlement || showProtectedAreas || queryReachOnClick) && (
          <RailSection title="Leyenda activa">
            <div className="flex flex-col gap-3">
              {queryReachOnClick && <ReturnPeriodLegend />}
              {(showSusceptibility || showVeredas) && (
                <SusceptibilityLegend
                  title={
                    showSusceptibility && showVeredas
                      ? "Susceptibilidad a inundación (zonificación oficial y modelo propio)"
                      : showSusceptibility
                        ? "Susceptibilidad a inundación (zonificaci��n oficial)"
                        : "Amenaza a inundación (modelo propio, por vereda)"
                  }
                />
              )}
              {showSettlement && <SettlementLegend />}
              {showProtectedAreas && <ProtectedAreasLegend />}
            </div>
          </RailSection>
        )}
      </MapControlRail>

      <StationDetailDialog
        station={selectedStation}
        onOpenChange={(open) => {
          if (!open) setSelectedStation(null)
        }}
      />
    </div>
  )
}

// MapLibre touches `window` at module load time, so this component is
// always consumed through GeoglowsLiveMapLoader (next/dynamic, ssr: false).
export default GeoglowsLiveMapImpl
