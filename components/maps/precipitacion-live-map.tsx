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
import { ExternalLink, Loader2, CloudRain, MapPinned, Building2, ShieldCheck } from "lucide-react"
import useSWR from "swr"
import { PRECIPITATION_LEVELS, PRECIPITATION_LEVEL_STYLES, precipitationLevelColorToken } from "@/lib/precipitacion/levels"
import { IMERG_TILE_URL, IMERG_WORLDVIEW_URL } from "@/lib/precipitacion/imerg"
import { ACCUMULATION_WINDOW_OPTIONS, FORECAST_WINDOW_OPTIONS } from "@/lib/precipitacion/api-types"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { normalizeMunicipioName } from "@/lib/demografia/categories"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
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
import type { PrecipitacionAmenazaResponse, PrecipitacionFuente, PrecipitacionMode } from "@/lib/precipitacion/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

/**
 * MapLibre GL port (see v0_plans/grand-method.md, Phase 3) — follows the
 * deslizamientos spike's patterns. No hazard data/model/API logic changed.
 */

const AOI_BOUNDS_ML: [[number, number], [number, number]] = [
  [-76.15, 3.88],
  [-75.72, 4.44],
]

const fetcher = async (url: string): Promise<PrecipitacionAmenazaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de precipitación")
  return res.json()
}

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

/** Precipitation color-scale rows, rendered inside the shared MapControlRail. */
function ThreatLegendList() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(PRECIPITATION_LEVELS.map((level) => resolveCssColor(precipitationLevelColorToken(level))))
  }, [])

  return (
    <ul className="flex flex-col gap-1">
      {PRECIPITATION_LEVELS.map((level, i) => (
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

function SettlementLegend() {
  return <WmsLegendChip src={GWIS_SETTLEMENT_LEGEND_URL} alt="Leyenda de asentamientos humanos (GHSL Built-Up)" />
}

function ProtectedAreasLegend() {
  return <WmsLegendChip src={GWIS_PROTECTED_AREAS_LEGEND_URL} alt="Leyenda de áreas protegidas (WDPA)" />
}

/**
 * Live precipitación map: renders each vereda colored by its rainfall
 * level, toggling between a backward-looking accumulation window (NASA
 * POWER, 7/14/30 días) and a forward-looking forecast (Open-Meteo, 7/14
 * días), with an optional GPM IMERG satellite precipitation-rate raster
 * overlay (NASA GIBS). Click a vereda for its accumulation/forecast and
 * level; the shared sidebar's population card narrows down to the same
 * vereda too, resolved by DIVIPOLA code against the RED LabOT veredas
 * layer that this map's own vereda polygons are already built from.
 */
function PrecipitacionLiveMapImpl({
  onBoundsChange,
  onZoneSelect,
  onVeredaSelect,
  onVeredaFeatureSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  /** Bubbles a clicked vereda's identity up, so the panel below the map can show its rainfall-normal histogram. */
  onVeredaSelect?: (vereda: { codigoVereda: string; nombre: string; municipio: string }) => void
  /** Bubbles the clicked vereda's full population/hazard feature up to the shared sidebar card. */
  onVeredaFeatureSelect?: (feature: VeredaFeature | null) => void
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

  const [mode, setMode] = useState<PrecipitacionMode>("pronostico")
  const [windowDays, setWindowDays] = useState<number>(7)
  const [fuente, setFuente] = useState<PrecipitacionFuente>("power")

  const { data, error } = useSWR<PrecipitacionAmenazaResponse>(
    `/api/precipitacion/amenaza?mode=${mode}&window=${windowDays}&fuente=${fuente}`,
    fetcher,
    { revalidateOnFocus: false },
  )
  const osmColors = useOsmCategoryColors()
  const { veredas: veredasPoblacion } = useVeredas(true)
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!data?.veredas) return []
    // Plain object instead of a `Map` instance: react-map-gl's default
    // `Map` export shadows the global `Map` constructor in this file.
    const byMunicipio: Record<string, Record<string, number>> = {}
    for (const feature of data.veredas.features) {
      const rawMunicipio = feature.properties?.municipio as string | undefined
      const nivel = feature.properties?.nivel as string | undefined
      const sinCobertura = feature.properties?.sinCobertura as boolean | undefined
      if (!rawMunicipio || !nivel || sinCobertura) continue
      const municipio = normalizeMunicipioName(rawMunicipio)
      const counts = byMunicipio[municipio] ?? {}
      counts[nivel] = (counts[nivel] ?? 0) + 1
      byMunicipio[municipio] = counts
    }
    return Object.entries(byMunicipio).map(([municipio, counts]) => ({
      municipio,
      items: PRECIPITATION_LEVELS.filter((level) => (counts[level] ?? 0) > 0).map((level) => ({
        label: level,
        value: `${counts[level]}`,
        colorToken: precipitationLevelColorToken(level),
      })),
    }))
  }, [data])

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [showImerg, setShowImerg] = useState(true)
  const [showVeredas, setShowVeredas] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")

  const windowOptions = mode === "pronostico" ? FORECAST_WINDOW_OPTIONS : ACCUMULATION_WINDOW_OPTIONS

  const handleModeChange = useCallback(
    (nextMode: PrecipitacionMode) => {
      setMode(nextMode)
      const nextOptions = nextMode === "pronostico" ? FORECAST_WINDOW_OPTIONS : ACCUMULATION_WINDOW_OPTIONS
      if (!(nextOptions as readonly number[]).includes(windowDays)) {
        setWindowDays(7)
      }
    },
    [windowDays],
  )

  const fuenteLabel = fuente === "ideam" ? "IDEAM" : "NASA POWER"
  const windowLabel =
    mode === "pronostico" ? `Pronóstico ${windowDays} días` : `Lluvia acumulada (${windowDays} días) · ${fuenteLabel}`
  const rowLabel = mode === "pronostico" ? `Pronóstico ${windowDays} días` : `Acumulado ${windowDays} días`

  useEffect(() => {
    const entries = PRECIPITATION_LEVELS.map((level) => [level, resolveCssColor(precipitationLevelColorToken(level))] as const)
    setResolvedColors(Object.fromEntries(entries))
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  const veredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data?.veredas || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: data.veredas.features.map((feature, i) => {
        const municipio = feature.properties?.municipio as string | undefined
        const nivel = feature.properties?.nivel as string | undefined
        const sinCobertura = feature.properties?.sinCobertura as boolean | undefined
        const active = municipio ? isMunicipioActive(municipio, activeMunicipios) : true
        const color = (nivel && resolvedColors[nivel]) || noDataColor
        return {
          type: "Feature",
          id: i,
          properties: {
            ...feature.properties,
            __fillColor: active ? color : noDataColor,
            __fillOpacity: !active ? 0.06 : sinCobertura ? 0.08 : 0.5,
            __lineColor: active ? color : noDataColor,
            __lineOpacity: active ? 1 : 0.3,
          },
          geometry: feature.geometry,
        }
      }),
    }
  }, [data, activeMunicipios, resolvedColors, noDataColor])

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

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = ["veredas-fill"]
    if (osmPoints && osmPoints.length > 0) ids.push("osm-points")
    return ids
  }, [osmPoints])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const { lng, lat } = e.lngLat
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
        const props = veredaFeature.properties as Record<string, unknown>
        const municipio = props.municipio as string | undefined
        const vereda = props.nombre as string | undefined
        const codigoVereda = props.codigoVereda as string | undefined
        const nivel = props.nivel as string | undefined
        const acumulado = props.acumuladoMm as number | undefined
        const dias = props.diasValidos as number | undefined
        const probabilidad = props.probabilidadMax as number | undefined
        const sinCobertura = props.sinCobertura as boolean | undefined
        const estacionNombre = props.estacionNombre as string | undefined
        const distanciaEstacionKm = props.distanciaEstacionKm as number | undefined

        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{vereda ?? municipio ?? "—"}</strong>
              {vereda && <span>{municipio ?? ""}</span>}
              {sinCobertura ? (
                <span>Sin cobertura de estaciones IDEAM cercanas</span>
              ) : (
                <>
                  <span>Nivel: {nivel ?? "—"}</span>
                  <span>
                    {rowLabel}: {acumulado != null ? `${acumulado} mm` : "—"}
                    {dias != null && dias < windowDays && mode !== "historico" ? ` (${dias} días con datos)` : ""}
                  </span>
                  {probabilidad != null && <span>Probabilidad máxima: {probabilidad}%</span>}
                  {estacionNombre && (
                    <span>
                      Estación: {estacionNombre} ({distanciaEstacionKm} km)
                    </span>
                  )}
                </>
              )}
            </div>
          ),
        })

        if (municipio) onZoneSelect?.(normalizeMunicipioName(municipio))
        if (codigoVereda && vereda && municipio) {
          onVeredaSelect?.({ codigoVereda, nombre: vereda, municipio })
          const found = veredasPoblacion?.features.find((f) => f.properties.codigoVereda === codigoVereda)
          onVeredaFeatureSelect?.(found ?? null)
        }
        return
      }
      setPopupInfo(null)
    },
    [onZoneSelect, onVeredaSelect, onVeredaFeatureSelect, veredasPoblacion, mode, windowDays, rowLabel],
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

    const bounds = boundsForActiveMunicipios(veredasPoblacion, activeMunicipios) as
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
  }, [veredasPoblacion, activeMunicipios])

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
  <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />

        {showImerg && (
          <Source id="imerg-source" type="raster" tiles={[IMERG_TILE_URL]} tileSize={256} maxzoom={6}>
            <Layer id="imerg" type="raster" paint={{ "raster-opacity": 0.6 }} />
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

        {data?.veredas && resolvedColors && (
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

      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          <span className="rounded-md bg-background/90 px-3 py-1.5 text-sm text-destructive shadow">
            No se pudo cargar la capa.
          </span>
        </div>
      )}

      <MapControlRail>
        <RailSection title="Municipios" first>
          <MunicipioTogglePanelContent
            active={activeMunicipiosMap}
            onToggle={toggleMunicipio}
            summaries={municipioSummaries}
            riskTitle="Precipitación (veredas por nivel)"
          />
        </RailSection>

        <RailSection title={windowLabel}>
          <ThreatLegendList />
        </RailSection>

        <RailSection title="Modo y ventana">
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Modo de datos">
            <button
              type="button"
              onClick={() => handleModeChange("historico")}
              aria-pressed={mode === "historico"}
              className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                mode === "historico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Histórico
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("pronostico")}
              aria-pressed={mode === "pronostico"}
              className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                mode === "pronostico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pronóstico
            </button>
          </div>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            aria-label="Ventana de días"
            className="mt-1 rounded-sm border border-border bg-card px-1.5 py-1 font-medium text-foreground"
          >
            {windowOptions.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
          {mode === "historico" && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              <span className="font-medium text-muted-foreground">Fuente:</span>
              <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Fuente de datos históricos">
                <button
                  type="button"
                  onClick={() => setFuente("power")}
                  aria-pressed={fuente === "power"}
                  className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                    fuente === "power" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  NASA POWER
                </button>
                <button
                  type="button"
                  onClick={() => setFuente("ideam")}
                  aria-pressed={fuente === "ideam"}
                  className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                    fuente === "ideam" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  IDEAM (estaciones)
                </button>
              </div>
            </div>
          )}
          {mode === "historico" && fuente === "ideam" && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Datos de estación en tiempo real, más precisos donde hay cobertura, pero solo cerca de Zarzal y
              Bugalagrande. Las veredas atenuadas no tienen estación cercana.
            </p>
          )}
        </RailSection>

        <RailSection title="Capas">
          <RailToggleRow icon={CloudRain} label="Tasa de precipitación (IMERG)" checked={showImerg} onChange={setShowImerg} />
          {showImerg && (
            <a
              href={IMERG_WORLDVIEW_URL}
              target="_blank"
              rel="noreferrer"
              className="ml-5 inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver escala en Worldview
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
          <RailToggleRow icon={MapPinned} label="Límites veredales" checked={showVeredas} onChange={setShowVeredas} />
          {showVeredas && (
            <p className="ml-5 text-[11px] leading-snug text-muted-foreground">
              Muestra el resumen de población e infraestructura de cada vereda.
            </p>
          )}
        </RailSection>

        <RailSection title="Cobertura y contexto">
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
// always consumed through PrecipitacionLiveMapLoader (next/dynamic, ssr: false).
export default PrecipitacionLiveMapImpl
