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
import { Loader2, Building2, ShieldCheck } from "lucide-react"
import { COMPOUND_LEVELS, compoundLevelColorToken } from "@/lib/riesgo-compuesto/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { maplibreBasemapStyle } from "@/lib/maps/maplibre-basemap-style"
import { wmsRasterSource } from "@/lib/maps/wms-raster-source"
import { MunicipioTogglePanelContent, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { MapControlRail, RailSection, RailToggleRow } from "@/components/maps/map-control-rail"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"
import { CompoundReportDialog } from "@/components/riesgo-compuesto/compound-report-dialog"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { WmsLegendChip } from "@/components/maps/wms-legend-chip"
import { GWIS_WMS_URL } from "@/lib/incendios/gwis"
import {
  GWIS_SETTLEMENT_LAYER,
  GWIS_SETTLEMENT_LEGEND_URL,
  GWIS_PROTECTED_AREAS_LAYER,
  GWIS_PROTECTED_AREAS_LEGEND_URL,
} from "@/lib/demografia/gwis-context-layers"
import { useCompoundVeredas } from "@/lib/riesgo-compuesto/use-compound-veredas"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { CompoundFeature, CompoundVeredaProperties } from "@/lib/riesgo-compuesto/api-types"

/**
 * MapLibre GL port (see v0_plans/grand-method.md, Phase 3) — follows the
 * deslizamientos spike's patterns. No hazard data/model/API logic changed.
 */

// Same AOI as the other three vereda maps (Sevilla, Caicedonia, Zarzal).
const AOI_BOUNDS: [[number, number], [number, number]] = [
  [-76.06, 3.88],
  [-75.72, 4.44],
]

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

function Legend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(COMPOUND_LEVELS.map((level) => resolveCssColor(compoundLevelColorToken(level))))
  }, [])

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Riesgo compuesto</p>
      <ul className="flex flex-col gap-1">
        {COMPOUND_LEVELS.map((level, i) => (
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

function CompoundPopupBody({
  feature,
  colors,
  noDataColor,
  onOpenReport,
}: {
  feature: CompoundFeature
  colors: Record<string, string>
  noDataColor: string
  onOpenReport: (feature: CompoundFeature) => void
}) {
  const props = feature.properties
  return (
    <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
      <strong>{props.nombre}</strong>
      <span style={{ color: "#888" }}>{props.municipio}</span>
      {props.compoundLevel ? (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: "50%",
              flexShrink: 0,
              backgroundColor: colors[props.compoundLevel] ?? noDataColor,
            }}
          />
          Riesgo compuesto: {props.compoundLevel} · {props.actionTier}
        </span>
      ) : (
        <span style={{ color: "#888" }}>Sin datos suficientes para calcular el riesgo compuesto</span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
        {props.subHazards.map((h) => (
          <span key={h.hazard} style={{ display: "flex", alignItems: "center", gap: 6, color: "#888" }}>
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                flexShrink: 0,
                backgroundColor: resolveCssColor(h.colorToken),
              }}
            />
            {h.label}: {h.rawLevel ?? "sin datos"}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onOpenReport(feature)}
        style={{
          marginTop: 6,
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--secondary)",
          color: "var(--secondary-foreground)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Ver reporte completo
      </button>
    </div>
  )
}

/**
 * Compound multi-hazard map: shades each vereda by the max-ordinal tier
 * across this app's four hazard models (see
 * lib/riesgo-compuesto/compound-model.ts), rather than any single live
 * layer — no GEOGLOWS/reach layer here, this category is the static
 * per-vereda compound picture. Click a vereda for its 4-hazard breakdown,
 * then "Ver reporte completo" for the full narrative report.
 */
function CompoundLiveMapImpl({
  onBoundsChange,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onVeredaSelect?: (feature: CompoundFeature) => void
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const mapRef = useRef<MapRef>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const mapStyle = useMemo(() => maplibreBasemapStyle(isDark), [isDark])

  const osmColors = useOsmCategoryColors()
  const { veredas, error: veredasError, isLoading: veredasLoading } = useCompoundVeredas(true)
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()
  const [reportFeature, setReportFeature] = useState<CompoundFeature | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!veredas) return []
    const byMunicipio: Record<string, Record<string, number>> = {}
    for (const feature of veredas.features) {
      const level = feature.properties.compoundLevel
      if (!level) continue
      const counts = byMunicipio[feature.properties.municipio] ?? {}
      counts[level] = (counts[level] ?? 0) + 1
      byMunicipio[feature.properties.municipio] = counts
    }
    return Object.entries(byMunicipio).map(([municipio, counts]) => ({
      municipio,
      items: COMPOUND_LEVELS.filter((level) => (counts[level] ?? 0) > 0).map((level) => ({
        label: level,
        value: `${counts[level]}`,
        colorToken: compoundLevelColorToken(level),
      })),
    }))
  }, [veredas])

  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)

  useEffect(() => {
    setResolvedColors({
      "Muy bajo": resolveCssColor(compoundLevelColorToken("Muy bajo")),
      Bajo: resolveCssColor(compoundLevelColorToken("Bajo")),
      Moderado: resolveCssColor(compoundLevelColorToken("Moderado")),
      Alto: resolveCssColor(compoundLevelColorToken("Alto")),
      "Muy alto": resolveCssColor(compoundLevelColorToken("Muy alto")),
    })
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  const veredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredas || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: veredas.features.map((feature) => {
        const active = isMunicipioActive(feature.properties.municipio, activeMunicipios)
        const fillColor = feature.properties.compoundLevel
          ? resolvedColors[feature.properties.compoundLevel]
          : noDataColor
        return {
          type: "Feature",
          id: feature.id,
          properties: {
            ...feature.properties,
            __subHazards: JSON.stringify(feature.properties.subHazards),
            __fillColor: active ? fillColor : noDataColor,
            __fillOpacity: active ? 0.65 : 0.12,
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
  }, [veredas, resolvedColors, noDataColor, activeMunicipios])

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
      if (veredaFeature && resolvedColors && noDataColor) {
        const rawProps = veredaFeature.properties as unknown as CompoundVeredaProperties & { __subHazards: string }
        const props: CompoundVeredaProperties = { ...rawProps, subHazards: JSON.parse(rawProps.__subHazards) }
        const feature = { properties: props } as CompoundFeature
        setPopupInfo({
          longitude: lng,
          latitude: lat,
          content: (
            <CompoundPopupBody
              feature={feature}
              colors={resolvedColors}
              noDataColor={noDataColor}
              onOpenReport={setReportFeature}
            />
          ),
        })
        onVeredaSelect?.(feature)
        return
      }
      setPopupInfo(null)
    },
    [onVeredaSelect, resolvedColors, noDataColor],
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
      className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}
    >
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
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-left" />
        <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />

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
            paint={{ "line-color": ["get", "__lineColor"], "line-opacity": ["get", "__lineOpacity"], "line-width": 1 }}
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
            riskTitle="Riesgo compuesto (veredas por nivel)"
          />
        </RailSection>

        <RailSection title="Riesgo compuesto">
          <Legend />
        </RailSection>

        <RailSection title="Infraestructura (OSM)">
          <OsmLegend points={osmPoints ?? []} />
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
      </MapControlRail>
      <CompoundReportDialog feature={reportFeature} onOpenChange={(open) => !open && setReportFeature(null)} />
    </div>
  )
}

// MapLibre touches `window` at module load time, so this component is
// always consumed through a next/dynamic loader with ssr: false.
export default CompoundLiveMapImpl
