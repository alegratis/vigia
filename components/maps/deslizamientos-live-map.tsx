"use client"

import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react"
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  Popup,
  WMSTileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { LatLngBoundsExpression, WMSParams } from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2 } from "lucide-react"
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
import { BasemapTileLayer } from "@/components/maps/basemap-tile-layer"
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
import { useFaults } from "@/lib/deslizamientos/use-faults"
import { useLandslideInventory } from "@/lib/deslizamientos/use-landslide-inventory"
import { VeredasOverlay } from "@/components/maps/veredas-overlay"
import { useVeredas } from "@/lib/veredas/use-veredas"
import type { VeredaFeature } from "@/lib/veredas/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

// Fallback center if bounds-fitting is unavailable — the midpoint of AOI_BOUNDS below.
const AOI_CENTER: [number, number] = [4.16, -75.89]

/**
 * Frames Sevilla and Caicedonia's full susceptibility extent (queried live
 * from the ArcGIS layer's envelope, west/south/east/north = -76.04/3.90/
 * -75.74/4.42, with a small margin). The map previously used a fixed center
 * pinned to the extent's northern edge, which showed only the northern
 * sliver of Sevilla and cropped out the rural, mountainous south where most
 * of the susceptibility zones sit.
 */
const AOI_BOUNDS: LatLngBoundsExpression = [
  [3.88, -76.06],
  [4.44, -75.72],
]

interface BoundsSyncProps {
  onBoundsChange: (bounds: MapBounds) => void
}

function BoundsSync({ onBoundsChange }: BoundsSyncProps) {
  const map = useMap()

  const sync = useCallback(() => {
    const b = map.getBounds()
    onBoundsChange({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    })
  }, [map, onBoundsChange])

  useEffect(() => {
    sync()
  }, [sync])

  useMapEvents({ moveend: sync, zoomend: sync, resize: sync })

  return null
}

function Legend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(SUSCEPTIBILITY_LEVELS.map((level) => resolveCssColor(levelColorToken(level))))
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Susceptibilidad a deslizamiento</p>
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
    </div>
  )
}

interface MapLayersControlProps {
  showSoilMoisture: boolean
  onSoilMoistureChange: (checked: boolean) => void
  showCriticalSites: boolean
  onCriticalSitesChange: (checked: boolean) => void
  showFaults: boolean
  onFaultsChange: (checked: boolean) => void
  showHistory: boolean
  onHistoryChange: (checked: boolean) => void
  showLandCover: boolean
  onLandCoverChange: (checked: boolean) => void
  showSettlement: boolean
  onSettlementChange: (checked: boolean) => void
  showProtectedAreas: boolean
  onProtectedAreasChange: (checked: boolean) => void
}

/**
 * Toggle panel for this map's optional overlays: SMAP root-zone soil
 * moisture (a satellite proxy for the antecedent-moisture signal this
 * map's own rainfall trigger already estimates from ground-station-
 * informed rainfall — worth cross-checking against, not a duplicate; its
 * own in-map legend, `SoilMoistureLegend` below, appears while toggled on),
 * "Sitios críticos" (field-surveyed road-damage points from the Valle del
 * Cauca infrastructure secretariat — see lib/deslizamientos/critical-sites.ts)
 * "Fallas geológicas" (SGC fault traces — the same layer already used as
 * the hazard model's fault-proximity factor, see lib/deslizamientos/faults.ts,
 * shown here as raw lines instead of a derived score), "Movimientos en
 * masa históricos" (the SGC's national mass-movement inventory — the same
 * layer already used as the hazard model's historical-proximity factor,
 * see lib/deslizamientos/landslide-inventory.ts) and "Cobertura del suelo"
 * (GWIS/EFFIS's MODIS land-cover layer — ground-cover/vegetation context
 * for exposure, shared with the fire map, see lib/land-cover/gwis-landcover.ts),
 * "Asentamientos humanos" (GHSL built-up, Sentinel-2 derived) and "Áreas
 * protegidas" (WDPA polygons) — both from the same GWIS server, shared
 * across every hazard map, see lib/demografia/gwis-context-layers.ts.
 */
function MapLayersControl({
  showSoilMoisture,
  onSoilMoistureChange,
  showCriticalSites,
  onCriticalSitesChange,
  showFaults,
  onFaultsChange,
  showHistory,
  onHistoryChange,
  showLandCover,
  onLandCoverChange,
  showSettlement,
  onSettlementChange,
  showProtectedAreas,
  onProtectedAreasChange,
}: MapLayersControlProps) {
  return (
    <div className="absolute left-3 top-3 z-[400] flex flex-col gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showSoilMoisture}
            onChange={(e) => onSoilMoistureChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Humedad del suelo (SMAP)
        </label>
      </div>
      <div className="border-t border-border pt-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showCriticalSites}
            onChange={(e) => onCriticalSitesChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Sitios críticos (2019)
        </label>
      </div>
      <div className="border-t border-border pt-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showFaults}
            onChange={(e) => onFaultsChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Fallas geológicas (SGC)
        </label>
      </div>
      <div className="border-t border-border pt-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => onHistoryChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Movimientos en masa históricos (SGC)
        </label>
      </div>
      <div className="border-t border-border pt-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showLandCover}
            onChange={(e) => onLandCoverChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Cobertura del suelo (MODIS)
        </label>
      </div>
      <div className="border-t border-border pt-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showSettlement}
            onChange={(e) => onSettlementChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Asentamientos humanos (GHSL)
        </label>
      </div>
      <div className="border-t border-border pt-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showProtectedAreas}
            onChange={(e) => onProtectedAreasChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Áreas protegidas (WDPA)
        </label>
      </div>
    </div>
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
 * Legend for the "Sitios críticos" overlay's severity scale
 * (`SEVERIDAD`, 1–4), shown only while the layer is toggled on. Positioned
 * by its parent — see `BottomRightLegends` — so it can stack with the
 * soil-moisture legend without overlapping.
 */
function CriticalSitesLegend() {
  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Sitios críticos — severidad</p>
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
 * the layer is toggled on.
 */
function SoilMoistureLegend() {
  const gradient = SMAP_COLOR_STOPS.map(
    (stop) => `${stop.rgb} ${((stop.value / SMAP_MAX_VALUE) * 100).toFixed(1)}%`,
  ).join(", ")

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Humedad del suelo (SMAP)</p>
      <div
        className="h-2.5 w-36 rounded-sm"
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

/** Stacks the optional bottom-right overlay legends so they never overlap. */
function BottomRightLegends({ children }: { children: ReactNode }) {
  return (
    <div className="absolute bottom-3 right-3 z-[400] flex flex-col items-end gap-2">{children}</div>
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
  const osmColors = useOsmCategoryColors()
  // Always enabled now that vereda shading is this map's primary layer, not
  // an opt-in overlay — VeredasOverlay's own useVeredas(true) call below
  // dedupes against this same SWR key, so this doesn't add a second request.
  const { error: veredasError, isLoading: veredasLoading } = useVeredas(true)

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [showSoilMoisture, setShowSoilMoisture] = useState(false)
  const [showCriticalSites, setShowCriticalSites] = useState(false)
  const [showFaults, setShowFaults] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showLandCover, setShowLandCover] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  const { points: criticalSites } = useCriticalSites(showCriticalSites)
  const { traces: faultTraces } = useFaults(showFaults)
  const { records: historyRecords } = useLandslideInventory(showHistory)
  const [faultLineColor, setFaultLineColor] = useState<string | null>(null)
  const [historyColor, setHistoryColor] = useState<string | null>(null)
  const [criticalSiteColors, setCriticalSiteColors] = useState<Record<number, string> | null>(null)

  useEffect(() => {
    const entries = SUSCEPTIBILITY_LEVELS.map(
      (level) => [level, resolveCssColor(levelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
    setFaultLineColor(resolveCssColor("var(--fault-line)"))
    setHistoryColor(resolveCssColor("var(--historical-event)"))
    // Canvas's 2D context can't resolve `var(--token)` strings the way DOM/CSS
    // can — `severityColorToken()` returning a raw CSS variable reference
    // straight into `pathOptions.fillColor` silently no-ops on
    // `ctx.fillStyle`, which is why the map's dots didn't match this same
    // severity scale's swatches in the legend (those render via a real DOM
    // `<span>`, where `var(...)` resolves fine). Resolve to actual color
    // values up front, same as every other overlay color above.
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

  const veredaColor = useCallback(
    (feature: VeredaFeature) => {
      const level = feature.properties.dominantLevel
      return level ? colorForLevel(level) : noDataColor ?? "var(--muted-foreground)"
    },
    [colorForLevel, noDataColor],
  )

  return (
    <div className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <MapContainer
        center={AOI_CENTER}
        zoom={11}
        minZoom={9}
        maxZoom={16}
        bounds={AOI_BOUNDS}
        zoomControl={false}
        attributionControl={false}
        preferCanvas
        className="h-full w-full"
      >
        <ZoomControl position="topright" />
        <AttributionControl position="bottomright" prefix="Leaflet" />
        <BasemapTileLayer />
        {showSoilMoisture && (
          <TileLayer
            attribution="NASA GIBS / SMAP"
            url={SMAP_TILE_URL}
            opacity={0.6}
            maxNativeZoom={6}
          />
        )}
        {showLandCover && (
          <WMSTileLayer
            url={GWIS_WMS_URL}
            opacity={0.55}
            params={
              {
                layers: GWIS_LANDCOVER_LAYER,
                format: "image/png",
                transparent: true,
                version: "1.1.1",
              } as WMSParams
            }
          />
        )}
        {showSettlement && (
          <WMSTileLayer
            url={GWIS_WMS_URL}
            opacity={0.7}
            params={
              {
                layers: GWIS_SETTLEMENT_LAYER,
                format: "image/png",
                transparent: true,
                version: "1.1.1",
              } as WMSParams
            }
          />
        )}
        {showProtectedAreas && (
          <WMSTileLayer
            url={GWIS_WMS_URL}
            opacity={0.6}
            params={
              {
                layers: GWIS_PROTECTED_AREAS_LAYER,
                format: "image/png",
                transparent: true,
                version: "1.1.1",
              } as WMSParams
            }
          />
        )}
        {resolvedColors && noDataColor && (
          <VeredasOverlay enabled colorForFeature={veredaColor} onSelect={onVeredaSelect} />
        )}
        {showFaults &&
          faultLineColor &&
          faultTraces?.map((trace) =>
            trace.paths.map((path, i) => {
              const positions = path.map(([lon, lat]) => [lat, lon] as [number, number])
              return (
                <Fragment key={`${trace.id}-${i}`}>
                  {/*
                   * A thin dashed line's clickable area (its `weight`, per
                   * Leaflet's canvas hit-testing) is only ~1px wide, so
                   * clicks land on the vereda polygon underneath almost
                   * every time. This invisible, much wider companion line
                   * carries the actual interaction — click opens the popup,
                   * hover shows the sticky tooltip — while the thin dashed
                   * line below stays purely decorative (`interactive:
                   * false`, so it can't compete for the same click/hover).
                   */}
                  <Polyline
                    key={`${trace.id}-${i}-hit`}
                    positions={positions}
                    pathOptions={{ color: faultLineColor, weight: 18, opacity: 0 }}
                  >
                    <Tooltip sticky>{trace.nombre ?? "Falla sin nombre"}</Tooltip>
                    <Popup>
                      <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong>{trace.nombre ?? "Falla sin nombre"}</strong>
                        <span>{trace.tipo ?? "Tipo no especificado"}</span>
                        <span style={{ color: "#888" }}>Servicio Geológico Colombiano (SGC)</span>
                      </div>
                    </Popup>
                  </Polyline>
                  <Polyline
                    key={`${trace.id}-${i}-line`}
                    positions={positions}
                    pathOptions={{
                      color: faultLineColor,
                      weight: 2,
                      dashArray: "6 4",
                      interactive: false,
                    }}
                  />
                </Fragment>
              )
            }),
          )}
        {showCriticalSites &&
          criticalSiteColors &&
          criticalSites?.map((site) => (
            <CircleMarker
              key={site.id}
              center={[site.lat, site.lon]}
              radius={5}
              pathOptions={{
                color: "#fff",
                weight: 1,
                fillColor: criticalSiteColors[site.severidad] ?? noDataColor ?? "#888",
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong>{tipoLabel(site.tipo)}</strong>
                  <span>{site.municipio}</span>
                  <span>{CRITICAL_SITE_SEVERITY_STYLES[site.severidad as 1 | 2 | 3 | 4]?.label ?? "—"}</span>
                  {site.observaciones && <span>{site.observaciones}</span>}
                  {site.fecha && <span style={{ color: "#888" }}>Registrado: {site.fecha}</span>}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        {showHistory &&
          historyColor &&
          historyRecords?.map((record) => (
            <CircleMarker
              key={record.id}
              center={[record.lat, record.lon]}
              radius={5}
              pathOptions={{
                color: "#fff",
                weight: 1,
                fillColor: historyColor,
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong>{record.tipo ?? "Movimiento sin tipo"}</strong>
                  <span>{record.subtipo ?? "Subtipo no especificado"}</span>
                  <span style={{ color: "#888" }}>
                    Inventario de movimientos en masa, Servicio Geológico Colombiano (SGC) — sin fecha registrada
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        {osmColors &&
          osmPoints?.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={5}
              pathOptions={{
                color: "#fff",
                weight: 1,
                fillColor: osmColors[p.category],
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong>{p.name ?? getOsmCategory(p.category).label}</strong>
                  <span>{getOsmCategory(p.category).label}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        {onBoundsChange && <BoundsSync onBoundsChange={onBoundsChange} />}
      </MapContainer>
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
      <MapLayersControl
        showSoilMoisture={showSoilMoisture}
        onSoilMoistureChange={setShowSoilMoisture}
        showCriticalSites={showCriticalSites}
        onCriticalSitesChange={setShowCriticalSites}
        showFaults={showFaults}
        onFaultsChange={setShowFaults}
        showHistory={showHistory}
        onHistoryChange={setShowHistory}
        showLandCover={showLandCover}
        onLandCoverChange={setShowLandCover}
        showSettlement={showSettlement}
        onSettlementChange={setShowSettlement}
        showProtectedAreas={showProtectedAreas}
        onProtectedAreasChange={setShowProtectedAreas}
      />
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      <Legend />
      {(showCriticalSites || showSoilMoisture || showLandCover || showSettlement || showProtectedAreas) && (
        <BottomRightLegends>
          {showSoilMoisture && <SoilMoistureLegend />}
          {showCriticalSites && <CriticalSitesLegend />}
          {showLandCover && <LandCoverLegend />}
          {showSettlement && <SettlementLegend />}
          {showProtectedAreas && <ProtectedAreasLegend />}
        </BottomRightLegends>
      )}
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through DeslizamientosLiveMapLoader (next/dynamic, ssr: false).
export default DeslizamientosLiveMapImpl
