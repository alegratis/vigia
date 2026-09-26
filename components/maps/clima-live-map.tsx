"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import MapGL, {
  Source,
  Layer,
  Marker,
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
import { Loader2, LandPlot } from "lucide-react"
import useSWR from "swr"
import {
  TEMP_LEVELS,
  tempLevelColorToken,
  type ClimaForecastResponse,
  type ClimaVeredaProperties,
} from "@/lib/clima/api-types"
import { WEATHER_GROUP_LABELS } from "@/lib/clima/weather-codes"
import { weatherGlyphSvg } from "@/lib/clima/weather-glyph"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { normalizeMunicipioName } from "@/lib/demografia/categories"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { MapViewToggle } from "@/components/maps/map-view-toggle"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"
import { maplibreBasemapStyle } from "@/lib/maps/maplibre-basemap-style"
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

const fetcher = async (url: string): Promise<ClimaForecastResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de clima")
  return res.json()
}

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

/**
 * Live clima map: a conventional weather report for the study area. Each
 * vereda is filled by its current temperature band. One prominent marker per
 * municipality shows its cabecera's current conditions (temperature +
 * weather glyph); clicking any vereda opens its full 7-day report in the card
 * below the map and narrows the shared sidebar's population figures to that
 * vereda. All data comes from Open-Meteo (lib/clima/weather-client.ts).
 */
function ClimaLiveMapImpl({
  onBoundsChange,
  onZoneSelect,
  onVeredaFeatureSelect,
  onClimaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  /** Bubbles the clicked vereda's full population/hazard feature up to the shared sidebar card. */
  onVeredaFeatureSelect?: (feature: VeredaFeature | null) => void
  /** Bubbles the clicked vereda's clima properties up so the report card below the map can render its forecast. */
  onClimaSelect?: (properties: ClimaVeredaProperties | null) => void
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

  const [showVeredas, setShowVeredas] = useState(false)

  const { data, error } = useSWR<ClimaForecastResponse>("/api/clima/forecast", fetcher, {
    revalidateOnFocus: false,
  })
  const osmColors = useOsmCategoryColors()
  const { veredas: veredasPoblacion } = useVeredas(true)
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()

  const [tempColors, setTempColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)

  useEffect(() => {
    setTempColors(Object.fromEntries(TEMP_LEVELS.map((l) => [l, resolveCssColor(tempLevelColorToken(l))])))
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  const colorsReady = tempColors && noDataColor

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!data?.veredas) return []
    // Plain object instead of a `Map` instance: react-map-gl's `MapGL`
    // export is fine here, but keeping the pattern consistent with the
    // precipitación map avoids any future accidental shadowing.
    const byMunicipio: Record<string, Record<string, number>> = {}
    for (const feature of data.veredas.features) {
      const rawMunicipio = feature.properties?.municipio
      const key = feature.properties?.nivelTemp
      if (!rawMunicipio || !key) continue
      const municipio = normalizeMunicipioName(rawMunicipio)
      const counts = byMunicipio[municipio] ?? {}
      counts[key] = (counts[key] ?? 0) + 1
      byMunicipio[municipio] = counts
    }
    return Object.entries(byMunicipio).map(([municipio, counts]) => ({
      municipio,
      items: (TEMP_LEVELS as readonly string[])
        .filter((level) => (counts[level] ?? 0) > 0)
        .map((level) => ({ label: level, value: `${counts[level]}`, colorToken: tempLevelColorToken(level) })),
    }))
  }, [data])

  const municipioMarkers = useMemo(() => {
    if (!data?.municipios) return []
    return data.municipios.map((m) => {
      const glyph = weatherGlyphSvg(m.grupoActual ?? "nublado", { size: 18, esDia: m.esDia })
      const temp = m.tempActual != null ? `${Math.round(m.tempActual)}°` : "—"
      const range =
        m.tempMax != null && m.tempMin != null
          ? `<span style="font-size:10px;font-weight:500;opacity:0.75">${Math.round(m.tempMax)}° / ${Math.round(m.tempMin)}°</span>`
          : ""
      const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;white-space:nowrap">
          <div style="display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:9999px;background:var(--card);color:var(--foreground);border:1px solid var(--border);box-shadow:0 1px 4px rgba(0,0,0,0.3);font-size:14px;font-weight:700;line-height:1">
            ${glyph}<span>${temp}</span>${range}
          </div>
          <span style="font-size:11px;font-weight:700;color:var(--foreground);text-shadow:0 1px 3px var(--background),0 0 3px var(--background)">${m.municipio}</span>
        </div>`
      return { municipio: m.municipio, lat: m.lat, lon: m.lon, html }
    })
  }, [data])

  const veredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data?.veredas || !colorsReady) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: data.veredas.features.map((feature, i) => {
        const props = feature.properties as ClimaVeredaProperties
        const municipio = props?.municipio
        const active = municipio ? isMunicipioActive(municipio, activeMunicipios) : true
        const color = (props?.nivelTemp && tempColors?.[props.nivelTemp]) || noDataColor
        return {
          type: "Feature",
          id: i,
          properties: {
            ...props,
            __fillColor: active ? color : noDataColor,
            __fillOpacity: !active ? 0.06 : props?.nivelTemp ? 0.55 : 0.08,
            __lineColor: active ? color : noDataColor,
            __lineOpacity: active ? 1 : 0.3,
          },
          geometry: feature.geometry,
        }
      }),
    }
  }, [data, colorsReady, tempColors, noDataColor, activeMunicipios])

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
    const ids: string[] = ["veredas-fill"]
    if (osmPoints && osmPoints.length > 0) ids.push("osm-points")
    return ids
  }, [osmPoints])

  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")

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
        const props = veredaFeature.properties as unknown as ClimaVeredaProperties
        const glyph = props.grupoActual ? weatherGlyphSvg(props.grupoActual, { size: 16, esDia: props.esDia }) : ""
        const condicion = props.grupoActual ? WEATHER_GROUP_LABELS[props.grupoActual] : "Sin dato"
        const tempActual = props.tempActual != null ? `${Math.round(props.tempActual)}°C` : "—"
        const rango =
          props.tempMaxHoy != null && props.tempMinHoy != null
            ? `${Math.round(props.tempMaxHoy)}° / ${Math.round(props.tempMinHoy)}°`
            : "—"

        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 3, minWidth: 170 }}>
              <strong>{props.nombre}</strong>
              <span>{props.municipio}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span dangerouslySetInnerHTML={{ __html: glyph }} />
                <span style={{ fontSize: 18, fontWeight: 700 }}>{tempActual}</span>
              </div>
              <span>{condicion}</span>
              {props.sensacionTermica != null && <span>Sensación térmica: {Math.round(props.sensacionTermica)}°C</span>}
              <span>Hoy: {rango}</span>
              <span>
                Racha seca prevista: {props.rachaSeca} día{props.rachaSeca === 1 ? "" : "s"}
              </span>
            </div>
          ),
        })

        if (props.municipio) onZoneSelect?.(normalizeMunicipioName(props.municipio))
        onClimaSelect?.(props)
        const populationFeature = veredasPoblacion?.features.find(
          (f) => f.properties.codigoVereda === props.codigoVereda,
        )
        onVeredaFeatureSelect?.(populationFeature ?? null)
        return
      }
      setPopupInfo(null)
    },
    [onZoneSelect, onClimaSelect, onVeredaFeatureSelect, veredasPoblacion],
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
      <MapGL
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
        <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />
        <MapViewToggle is3D={is3D} onToggle={() => setMapPitch(!is3D)} className="left-3 top-20" />

        {data?.veredas && colorsReady && (
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

        {municipioMarkers.map((m) => (
          <Marker key={m.municipio} longitude={m.lon} latitude={m.lat}>
            <div dangerouslySetInnerHTML={{ __html: m.html }} />
          </Marker>
        ))}

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
      </MapGL>

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
            riskTitle="Temperatura (veredas por banda)"
          />
        </RailSection>

        <RailSection title="Temperatura actual">
          <ul className="flex flex-col gap-1">
            {TEMP_LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tempColors?.[level] ?? "transparent" }}
                  aria-hidden="true"
                />
                {level}
              </li>
            ))}
          </ul>
        </RailSection>

        <RailSection title="Capas">
          <RailToggleRow icon={LandPlot} label="Límites veredales" checked={showVeredas} onChange={setShowVeredas} />
          {showVeredas && (
            <p className="pl-6 text-[11px] leading-snug text-muted-foreground">
              Muestra el resumen de población e infraestructura de cada vereda.
            </p>
          )}
        </RailSection>

        {osmPoints && osmPoints.length > 0 && (
          <RailSection title="Infraestructura (OSM)">
            <OsmLegend points={osmPoints} />
          </RailSection>
        )}
      </MapControlRail>
    </div>
  )
}

// MapLibre touches `window` at module load time, so this component is
// always consumed through ClimaLiveMapLoader (next/dynamic, ssr: false).
export default ClimaLiveMapImpl
