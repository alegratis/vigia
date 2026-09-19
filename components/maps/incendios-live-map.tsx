"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  TileLayer,
  WMSTileLayer,
  GeoJSON,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { Layer, LatLngBoundsExpression, LeafletMouseEvent, PathOptions, WMSParams } from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2 } from "lucide-react"
import useSWR from "swr"
import { BasemapTileLayer } from "@/components/maps/basemap-tile-layer"
import {
  FIRE_THREAT_LEVELS,
  FIRE_THREAT_LEVEL_STYLES,
  fireLevelColorToken,
} from "@/lib/incendios/levels"
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
import { normalizeMunicipioName } from "@/lib/demografia/categories"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { VeredasOverlay } from "@/components/maps/veredas-overlay"
import { MunicipioTogglePanel, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { summarizeByMunicipio } from "@/lib/veredas/municipio-summary"
import { WmsLegendChip } from "@/components/maps/wms-legend-chip"
import type { IncendiosAmenazaResponse } from "@/lib/incendios/api-types"
import type { FireDetection, FiresResponse } from "@/lib/firms/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

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

// Fallback center if bounds-fitting is unavailable — the midpoint of AOI_BOUNDS below.
const AOI_CENTER: [number, number] = [4.28, -75.9]

/** Frames Sevilla and Caicedonia's full fire-threat extent, same AOI as the landslide map. */
const AOI_BOUNDS: LatLngBoundsExpression = [
  [3.88, -76.06],
  [4.44, -75.72],
]

const fetcher = async (url: string): Promise<IncendiosAmenazaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de amenaza por incendios")
  return res.json()
}

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

function ThreatLegend({ title }: { title: string }) {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(FIRE_THREAT_LEVELS.map((level) => resolveCssColor(fireLevelColorToken(level))))
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">{title}</p>
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
    </div>
  )
}

function FwiLegend() {
  return (
    <WmsLegendChip src={GWIS_LEGEND_URL} alt="Escala del Índice Meteorológico de Incendio (FWI)" />
  )
}

function FireLegend({ colors }: { colors: Record<FireDetection["confidence"], string> | null }) {
  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Focos activos (MODIS / VIIRS)</p>
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
 * Live forest-fire threat map: colors every vereda by this app's own
 * forest-fire hazard model (slope + road proximity + NASA FIRMS
 * historical recurrence + today's Fire Weather Index — see
 * lib/incendios/hazard-model.ts), on by default and covering all three
 * municipios including Zarzal. The public `AmenazaIncendios` polygons
 * published on ArcGIS Online — a static 2014 PBOT land-use zoning, only
 * covering Sevilla and Caicedonia — are kept as an optional
 * "Zonificación oficial" reference toggle, off by default. Optional
 * overlays add GWIS/Copernicus EFFIS's Fire Weather Index (FWI) forecast
 * and active fires by sensor (MODIS and VIIRS as NASA FIRMS points,
 * Sentinel-3 as a GWIS WMS tile — see lib/incendios/gwis.ts). Click a
 * vereda (own model) or zone (official zoning) for its detail, or click
 * a vereda while "Modelo propio de incendios forestales" is on to narrow
 * the shared sidebar's population card and the FireModelPanel down to it
 * (same mechanism the deslizamientos map uses).
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
  const { data, error } = useSWR<IncendiosAmenazaResponse>("/api/incendios/amenaza", fetcher, {
    revalidateOnFocus: false,
  })
  const osmColors = useOsmCategoryColors()
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()
  // Fetched here (as well as inside VeredasOverlay) to drive the municipality
  // risk panel off this app's own fire model rather than AmenazaIncendios'
  // Sevilla/Caicedonia-only coverage; the shared SWR key dedupes so this adds
  // no second request.
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
  const [showForecast, setShowForecast] = useState(true)
  const dayOptions = useMemo(() => forecastDayOptions(), [])
  const [selectedDay, setSelectedDay] = useState(dayOptions[0].value)

  // Active fires, broken down by sensor per gwis_current_situation's own
  // layer picker: MODIS and VIIRS come from NASA FIRMS as geolocated points
  // (rich popups); Sentinel-3 has no FIRMS source, so it renders as a GWIS
  // WMS raster tile instead (see GWIS_S3_HOTSPOT_LAYER above).
  // Both FIRMS point sensors on by default — the model's historical
  // recurrence factor now counts detections from both (see
  // lib/incendios/fire-history.ts), so the live layer defaults to
  // showing the same full picture rather than hiding MODIS.
  const [showModis, setShowModis] = useState(true)
  const [showViirs, setShowViirs] = useState(true)
  const [showSentinel3, setShowSentinel3] = useState(false)
  // Own model on by default — the vereda-colored layer is now this map's
  // primary hazard surface; AmenazaIncendios (below) is demoted to an
  // optional reference toggle, off by default.
  const [showFireModel, setShowFireModel] = useState(true)
  const [showOfficialZoning, setShowOfficialZoning] = useState(false)
  const [showLandCover, setShowLandCover] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  const [fireDays, setFireDays] = useState<number>(2)
  const needsFirms = showModis || showViirs
  const { data: firesData } = useSWR<FiresResponse>(
    needsFirms ? `/api/incendios?days=${fireDays}` : null,
    firesFetcher,
    { revalidateOnFocus: false },
  )
  const [fireColors, setFireColors] = useState<Record<FireDetection["confidence"], string> | null>(
    null,
  )

  const visibleFires = useMemo(
    () =>
      firesData?.detections.filter((d) => (d.sensor === "modis" ? showModis : showViirs)) ?? [],
    [firesData, showModis, showViirs],
  )

  useEffect(() => {
    const entries = FIRE_THREAT_LEVELS.map(
      (level) => [level, resolveCssColor(fireLevelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
  }, [])

  useEffect(() => {
    const entries = (Object.keys(CONFIDENCE_STYLES) as FireDetection["confidence"][]).map(
      (key) => [key, resolveCssColor(CONFIDENCE_STYLES[key].color)] as const,
    )
    setFireColors(Object.fromEntries(entries) as Record<FireDetection["confidence"], string>)
  }, [])

  const style = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.Amenaza_Label as string | undefined
      const municipio = feature?.properties?.NOMB_MPIO as string | undefined
      const active = municipio ? isMunicipioActive(municipio, activeMunicipios) : true
      const color = (level && resolvedColors?.[level]) || "var(--muted-foreground)"
      // Dimmed (municipality toggled off): grey the fill down so the active
      // municipalities' fire-threat coloring stays the focus.
      if (!active) {
        return { color: "var(--muted-foreground)", weight: 1, opacity: 0.3, fillColor: "var(--muted-foreground)", fillOpacity: 0.06 }
      }
      return {
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.5,
      }
    },
    [resolvedColors, activeMunicipios],
  )

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: Layer) => {
      const municipio = feature.properties?.NOMB_MPIO as string | undefined
      const vereda = feature.properties?.NOMBRE_VER as string | undefined
      const nivel = feature.properties?.Amenaza_Label as string | undefined
      const active = municipio ? isMunicipioActive(municipio, activeMunicipios) : true
      layer.bindPopup(
        `<div style="font-size:13px;display:flex;flex-direction:column;gap:2px">
        <strong>${vereda ?? municipio ?? "—"}</strong>
        ${vereda ? `<span>${municipio ?? ""}</span>` : ""}
        <span>Amenaza: ${nivel ?? "—"}</span>
      </div>`,
      )
      // Skip the hover emphasis on dimmed (toggled-off) municipalities.
      if (active) {
        layer.on("mouseover", (e: LeafletMouseEvent) => {
          ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.75 })
        })
        layer.on("mouseout", (e: LeafletMouseEvent) => {
          ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.5 })
        })
      }
      layer.on("click", () => {
        if (municipio) onZoneSelect?.(normalizeMunicipioName(municipio))
      })
    },
    [onZoneSelect, activeMunicipios],
  )

  // Re-key the GeoJSON layer once colors resolve so Leaflet re-applies `style`
  // per feature, and again when the municipality selection changes so the
  // dimming/hover-guard reflect the new active set.
  const geoJsonKey = useMemo(
    () => `${resolvedColors ? "resolved" : "pending"}-${activeMunicipios.join(",")}`,
    [resolvedColors, activeMunicipios],
  )

  // This app's own forest-fire model (lib/incendios/hazard-model.ts) is
  // deliberately scored onto AmenazaIncendios' own 4-level vocabulary, so
  // it reuses the same resolved colors above rather than a second palette.
  const veredaFireColor = useCallback(
    (feature: VeredaFeature) => (feature.properties.fireLevel && resolvedColors?.[feature.properties.fireLevel]) || "var(--muted-foreground)",
    [resolvedColors],
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
        className="h-full w-full"
      >
        <ZoomControl position="topright" />
        <AttributionControl position="bottomright" prefix="Leaflet" />
        <BasemapTileLayer />
        {showForecast && (
          <WMSTileLayer
            url={GWIS_WMS_URL}
            opacity={0.55}
            // GWIS' forecast TIME parameter isn't part of Leaflet's WMSParams type,
            // but TileLayer.WMS forwards any extra key straight into the query string.
            params={
              {
                layers: GWIS_FWI_LAYER,
                format: "image/png",
                transparent: true,
                version: "1.1.1",
                TIME: selectedDay,
              } as WMSParams
            }
          />
        )}
        {showOfficialZoning && data?.polygons && resolvedColors && (
          <GeoJSON
            key={geoJsonKey}
            data={data.polygons as unknown as GeoJSON.GeoJsonObject}
            style={style}
            onEachFeature={onEachFeature}
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
        <VeredasOverlay
          enabled={showFireModel}
          onSelect={onVeredaSelect}
          colorForFeature={veredaFireColor}
          hazardKind="incendios"
          activeMunicipios={activeMunicipios}
        />
        {showSentinel3 && (
          <WMSTileLayer
            url={GWIS_WMS_URL}
            opacity={0.85}
            params={
              {
                layers: GWIS_S3_HOTSPOT_LAYER,
                format: "image/png",
                transparent: true,
                version: "1.1.1",
              } as WMSParams
            }
          />
        )}
        {fireColors &&
          visibleFires.map((d) => (
            <CircleMarker
              key={d.id}
              center={[d.lat, d.lon]}
              radius={fireRadius(d.frp)}
              pathOptions={{
                color: "#fff",
                weight: 1,
                fillColor: fireColors[d.confidence],
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong>{formatDateTime(d.acquiredAt)}</strong>
                  <span>
                    Cerca de {d.nearest.name} · {formatDistance(d.nearest.distanceKm)}
                  </span>
                  <span>Confianza: {CONFIDENCE_STYLES[d.confidence].label}</span>
                  <span>FRP: {formatFrp(d.frp)}</span>
                  <span>Satélite: {d.satellite}</span>
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

      <div className="absolute left-3 top-3 z-[400] flex flex-col gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={showForecast}
              onChange={(e) => setShowForecast(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Pronóstico FWI (ECMWF / GWIS)
          </label>
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
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border pt-1.5">
          <p className="font-medium text-foreground">Focos activos</p>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={showModis}
              onChange={(e) => setShowModis(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            MODIS
          </label>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={showViirs}
              onChange={(e) => setShowViirs(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            VIIRS (todas)
          </label>
          <label className="flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={showSentinel3}
              onChange={(e) => setShowSentinel3(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Sentinel-3
          </label>
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
        </div>
        <div className="border-t border-border pt-1.5">
          <label className="flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={showLandCover}
              onChange={(e) => setShowLandCover(e.target.checked)}
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
              onChange={(e) => setShowSettlement(e.target.checked)}
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
              onChange={(e) => setShowProtectedAreas(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Áreas protegidas (WDPA)
          </label>
        </div>
        <div className="border-t border-border pt-1.5">
          <label className="flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={showFireModel}
              onChange={(e) => setShowFireModel(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Modelo propio de incendios forestales (por vereda, incluye Zarzal)
          </label>
          <label className="flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={showOfficialZoning}
              onChange={(e) => setShowOfficialZoning(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Zonificación oficial (PBOT 2014, Sevilla/Caicedonia)
          </label>
        </div>
      </div>

      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      {error && (
        <Popup position={AOI_CENTER}>
          <span className="text-sm text-destructive">No se pudo cargar la capa.</span>
        </Popup>
      )}
      {(showFireModel || showOfficialZoning) && (
        <ThreatLegend
          title={
            showFireModel && showOfficialZoning
              ? "Amenaza por incendios (modelo propio y zonificación oficial)"
              : showFireModel
                ? "Amenaza por incendios forestales (modelo propio, por vereda)"
                : "Amenaza por incendios forestales (zonificación oficial, PBOT 2014)"
          }
        />
      )}
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      <MunicipioTogglePanel
        active={activeMunicipiosMap}
        onToggle={toggleMunicipio}
        summaries={municipioSummaries}
        riskTitle="Amenaza de incendio (modelo propio, veredas por nivel)"
      />
      {(showForecast || needsFirms || showSentinel3 || showLandCover || showSettlement || showProtectedAreas) && (
        <div className="absolute bottom-3 right-3 z-[400] flex flex-col items-end gap-2">
          {showForecast && <FwiLegend />}
          {needsFirms && <FireLegend colors={fireColors} />}
          {showSentinel3 && <S3Legend />}
          {showLandCover && <LandCoverLegend />}
          {showSettlement && <SettlementLegend />}
          {showProtectedAreas && <ProtectedAreasLegend />}
        </div>
      )}
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through IncendiosLiveMapLoader (next/dynamic, ssr: false).
export default IncendiosLiveMapImpl
