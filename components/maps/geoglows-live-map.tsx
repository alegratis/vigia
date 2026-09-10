"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  TileLayer,
  ImageOverlay,
  GeoJSON,
  Marker,
  Pane,
  Popup,
  WMSTileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { Layer, LatLngBoundsExpression, LeafletMouseEvent, PathOptions, WMSParams } from "leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ExternalLink, Loader2 } from "lucide-react"
import { BasemapTileLayer } from "@/components/maps/basemap-tile-layer"
import useSWR from "swr"
import {
  AOI_BOUNDS,
  AOI_CENTER,
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
import { VeredasOverlay } from "@/components/maps/veredas-overlay"
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
import type { VeredaFeature } from "@/lib/veredas/api-types"

function toLatLngBounds(b: LatLngBounds): LatLngBoundsExpression {
  return [
    [b.south, b.west],
    [b.north, b.east],
  ]
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
 * Names singled out for a thicker, brighter line and their own popup
 * emphasis — Río Totoro (GEOGLOWS rivid 610330643) and Quebrada San José,
 * both specifically asked about when this layer was added.
 */
const HIGHLIGHTED_STREAM_NAMES = new Set(["Río Totoro", "Quebrada San José"])

const stationIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:#fff;border:2px solid #1e3a8a;box-shadow:0 0 0 2px rgba(0,0,0,0.25)"></span>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

interface OverlaySyncProps {
  onBoundsChange: (bounds: MapBounds) => void
  onOverlayChange: (bounds: LatLngBounds, width: number, height: number) => void
}

/** Tracks the map viewport and reports it both as an export overlay request and to the shared bounds contract. */
function OverlaySync({ onBoundsChange, onOverlayChange }: OverlaySyncProps) {
  const map = useMap()

  const sync = useCallback(() => {
    const b = map.getBounds()
    const size = map.getSize()
    const bounds: LatLngBounds = {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    }
    onOverlayChange(bounds, size.x, size.y)
    onBoundsChange(bounds)
  }, [map, onBoundsChange, onOverlayChange])

  useEffect(() => {
    sync()
  }, [sync])

  useMapEvents({
    moveend: sync,
    zoomend: sync,
    resize: sync,
  })

  return null
}

/**
 * Listens for map clicks and queries GEOGLOWS' identify endpoint for the
 * reach under the cursor — gated behind `enabled` (the "Consultar río al
 * hacer clic" toggle). The GEOGLOWS raster has no real transparent gaps:
 * its identify service answers for *any* lat/lng, "no reach here" included,
 * so this handler unconditionally wins every map click it's attached to —
 * there's no z-order trick that makes a vereda or quebrada polygon "more
 * clickable" underneath it. `enabled` is the only thing that decides
 * whether this layer participates in a click at all; the image overlay
 * itself always keeps rendering as a plain graphic regardless.
 */
function ReachClickLayer({ enabled }: { enabled: boolean }) {
  const map = useMap()
  const [popup, setPopup] = useState<{ lat: number; lon: number; loading: boolean; info: ReachInfo | null; error: string | null } | null>(
    null,
  )

  useEffect(() => {
    if (!enabled) setPopup(null)
  }, [enabled])

  useMapEvents(
    enabled
      ? {
          click: async (e) => {
            const { lat, lng } = e.latlng
            setPopup({ lat, lon: lng, loading: true, info: null, error: null })
            const b = map.getBounds()
            const size = map.getSize()
            try {
              const info = await identifyReach(
                lat,
                lng,
                { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
                size.x,
                size.y,
              )
              setPopup({ lat, lon: lng, loading: false, info, error: info ? null : "no-reach" })
            } catch {
              setPopup({ lat, lon: lng, loading: false, info: null, error: "network" })
            }
          },
        }
      : {},
  )

  if (!popup) return null

  return (
    <Popup position={[popup.lat, popup.lon]} eventHandlers={{ remove: () => setPopup(null) }}>
      <div className="flex min-w-48 flex-col gap-1.5 text-sm">
        {popup.loading && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Consultando GEOGLOWS…
          </span>
        )}
        {!popup.loading && popup.error === "no-reach" && (
          <span className="text-muted-foreground">Sin tramo de río en este punto.</span>
        )}
        {!popup.loading && popup.error === "network" && (
          <span className="text-destructive">No se pudo consultar el servicio.</span>
        )}
        {!popup.loading && popup.info && (
          <>
            <span className="flex items-center gap-2 font-semibold">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: returnPeriodColor(popup.info.returnPeriod) }}
                aria-hidden="true"
              />
              {returnPeriodLabel(popup.info.returnPeriod)}
            </span>
            {popup.info.meanFlowCms != null && (
              <span>Caudal medio: {formatFlow(popup.info.meanFlowCms)}</span>
            )}
            {popup.info.strahlerOrder != null && (
              <span className="text-muted-foreground">
                Orden de Strahler: {popup.info.strahlerOrder}
              </span>
            )}
            {popup.info.forecastTimestamp && (
              <span className="text-xs text-muted-foreground">
                Pronóstico: {popup.info.forecastTimestamp}
              </span>
            )}
            <span className="text-xs text-muted-foreground">Fuente: GEOGLOWS / Esri Living Atlas</span>
          </>
        )}
      </div>
    </Popup>
  )
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
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Periodo de retorno (río, en vivo)</p>
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
 * layer and this app's own vereda-level flood model, since both are
 * deliberately scored onto the same 5-level vocabulary (see
 * lib/inundaciones/hazard-model.ts). Shown while either layer is on.
 */
function SusceptibilityLegend({ title }: { title: string }) {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(
      FLOOD_SUSCEPTIBILITY_LEVELS.map((level) => resolveCssColor(floodSusceptibilityColorToken(level))),
    )
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">{title}</p>
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
 * Live GEOGLOWS flood map: renders their published ArcGIS Living Atlas
 * "GlobalWaterModel_Medium" layer directly over OpenStreetMap, centered on
 * the study area, plus the static flood-susceptibility zoning
 * (`susceptibilidad_inundaciones`, see lib/inundaciones/client.ts) and
 * vereda boundaries — colored by this app's own flood hazard model (see
 * lib/inundaciones/hazard-model.ts), same "Límites veredales" toggle
 * pattern the deslizamientos map uses for its own landslide model — as
 * toggleable layers underneath. The official zoning layer only covers
 * Sevilla/Caicedonia's zoned extent; the vereda layer's own model reaches
 * all three municipios, including Zarzal, and both can be on at once
 * (zoning underneath, the model's vereda coloring on top). This app's own
 * model is the default-on layer (the official zoning starts off, since
 * it's a secondary, narrower-coverage reference) — click any reach for
 * its live GEOGLOWS forecast attributes, any susceptibility zone for its
 * official threat level, or a vereda boundary for its own model's factors
 * — which also narrows the shared sidebar's population card down to it
 * (same mechanism the deslizamientos map uses).
 *
 * The GEOGLOWS river layer sits in its own high-zIndex pane so it's
 * always drawn on top of the zoning/vereda fills, and the vereda overlay
 * is given `blockMapClick={false}` here (unlike the deslizamientos map's
 * default) so a click on a vereda still reaches `ReachClickLayer`'s
 * generic map click underneath instead of being swallowed by the vereda
 * polygon's own popup — the vereda's own summary stays available through
 * the sidebar narrowing instead.
 *
 * That underlying map click only queries GEOGLOWS when "Consultar río al
 * hacer clic" is on (off by default). GEOGLOWS' identify endpoint has no
 * real transparent gaps — it answers "no reach here" for literally any
 * lat/lng — so leaving it always-on would mean it wins every click,
 * vereda and quebrada clicks included, no matter how z-order is
 * arranged. With it off, the raster still renders as a plain graphic
 * (see `ReachClickLayer`'s doc); turning it on lets a click both query
 * the river *and* still narrow the sidebar to a vereda underneath, since
 * `blockMapClick={false}` never stopped that propagation.
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
  const [overlay, setOverlay] = useState<{ bounds: LatLngBounds; width: number; height: number } | null>(
    null,
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const [showSusceptibility, setShowSusceptibility] = useState(false)
  const [showPrecipitation, setShowPrecipitation] = useState(false)
  const [showVeredas, setShowVeredas] = useState(true)
  const [showQuebradas, setShowQuebradas] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)
  // Off by default: our own model is the default click target (see module
  // doc above). GEOGLOWS' identify endpoint answers for any lat/lng, so
  // leaving this always-on would mean every click — including one meant
  // for a vereda or quebrada underneath — gets swallowed by the river
  // layer's own popup instead. The raster graphic itself still always
  // renders; this only gates whether clicks query it.
  const [queryReachOnClick, setQueryReachOnClick] = useState(false)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const osmColors = useOsmCategoryColors()

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
  useEffect(() => {
    const entries = FLOOD_SUSCEPTIBILITY_LEVELS.map(
      (level) => [level, resolveCssColor(floodSusceptibilityColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
  }, [])

  const susceptibilityStyle = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.descripcio as string | undefined
      const color = (level && resolvedColors?.[level]) || "var(--muted-foreground)"
      return {
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.45,
      }
    },
    [resolvedColors],
  )

  // Reuses the same resolved zoning-level colors above — this app's own
  // flood hazard model (lib/inundaciones/hazard-model.ts) is deliberately
  // scored onto the zoning layer's own 5-level vocabulary, so one palette
  // covers both.
  const veredaFloodColor = useCallback(
    (feature: VeredaFeature): string => {
      const level = feature.properties.floodLevel
      return (level && resolvedColors?.[level]) || "var(--muted-foreground)"
    },
    [resolvedColors],
  )

  const onEachSusceptibilityFeature = useCallback(
    (feature: GeoJSON.Feature, layer: Layer) => {
      const nivel = feature.properties?.descripcio as string | undefined
      layer.bindPopup(
        `<div style="font-size:13px;display:flex;flex-direction:column;gap:2px">
        <strong>Susceptibilidad a inundación</strong>
        <span>${nivel ?? "—"}</span>
      </div>`,
      )
      layer.on("mouseover", (e: LeafletMouseEvent) => {
        ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.7 })
      })
      layer.on("mouseout", (e: LeafletMouseEvent) => {
        ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.45 })
      })
      // Stop the click from bubbling to the map's own click handler (ReachClickLayer),
      // which would otherwise fire its GEOGLOWS reach lookup on every zone click and
      // steal the popup — Leaflet only keeps one open per map.
      layer.on("click", (e: LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        // The zone itself carries no municipio field, only a threat level —
        // resolve the closest of the three reference points to the click
        // instead, same approach as the nearby-fire tagging in FIRMS.
        const nearest = nearestPoint(e.latlng.lat, e.latlng.lng, REFERENCE_POINTS)
        if (nearest) onZoneSelect?.(nearest.name)
      })
    },
    [onZoneSelect],
  )

  // Re-key the GeoJSON layer once colors resolve so Leaflet re-applies `style` per feature.
  const susceptibilityGeoJsonKey = useMemo(
    () => (resolvedColors ? "resolved" : "pending"),
    [resolvedColors],
  )

  const quebradaStyle = useCallback((feature?: GeoJSON.Feature): PathOptions => {
    const nombre = feature?.properties?.nombre as string | undefined
    const highlighted = nombre ? HIGHLIGHTED_STREAM_NAMES.has(nombre) : false
    return {
      color: highlighted ? "#38bdf8" : "#0ea5e9",
      weight: highlighted ? 4 : 2,
      opacity: highlighted ? 1 : 0.75,
    }
  }, [])

  const onEachQuebradaFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const nombre = feature.properties?.nombre as string | undefined
    const source = feature.properties?.source as string | undefined
    layer.bindPopup(
      `<div style="font-size:13px;display:flex;flex-direction:column;gap:2px">
        <strong>${nombre ?? "Quebrada / río"}</strong>
        <span>${source === "osm" ? "Fuente: OpenStreetMap" : "Fuente: capa Quebradas (ArcGIS)"}</span>
      </div>`,
    )
    // Same guard as the susceptibility zones: stop this popup click from
    // also firing ReachClickLayer's GEOGLOWS reach lookup underneath it.
    layer.on("click", (e: LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
    })
  }, [])

  const handleOverlayChange = useCallback((bounds: LatLngBounds, width: number, height: number) => {
    setOverlay({ bounds, width, height })
  }, [])

  const overlayUrl = useMemo(() => {
    if (!overlay) return null
    return buildExportUrl(overlay.bounds, overlay.width, overlay.height)
  }, [overlay])

  return (
    <div
      ref={containerRef}
      className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}
    >
      <MapContainer
        center={AOI_CENTER}
        zoom={11}
        minZoom={6}
        maxZoom={16}
        className="h-full w-full"
        bounds={toLatLngBounds(AOI_BOUNDS)}
        zoomControl={false}
        attributionControl={false}
      >
        <ZoomControl position="topright" />
        <AttributionControl position="bottomright" prefix="Leaflet" />
        <BasemapTileLayer />
        {showSusceptibility && susceptibility?.polygons && resolvedColors && (
          <GeoJSON
            key={susceptibilityGeoJsonKey}
            data={susceptibility.polygons as unknown as GeoJSON.GeoJsonObject}
            style={susceptibilityStyle}
            onEachFeature={onEachSusceptibilityFeature}
          />
        )}
        {showPrecipitation && (
          <TileLayer attribution="NASA GIBS / IMERG" url={IMERG_TILE_URL} opacity={0.6} maxNativeZoom={6} />
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
          enabled={showVeredas}
          onSelect={onVeredaSelect}
          colorForFeature={veredaFloodColor}
          hazardKind="inundaciones"
          blockMapClick={false}
        />
        {showQuebradas && quebradas?.lines && (
          <GeoJSON
            key={`quebradas-${quebradas.generatedAt}`}
            data={quebradas.lines as unknown as GeoJSON.GeoJsonObject}
            style={quebradaStyle}
            onEachFeature={onEachQuebradaFeature}
          />
        )}
        <Pane name="geoglows-reach-pane" style={{ zIndex: 450 }}>
          {overlayUrl && overlay && (
            <ImageOverlay url={overlayUrl} bounds={toLatLngBounds(overlay.bounds)} opacity={0.9} />
          )}
        </Pane>
        {STATIONS.map((s) => (
          <Marker key={s.slug} position={[s.lat, s.lon]} icon={stationIcon}>
            <Popup>
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">{s.name}</span>
                <span className="text-muted-foreground">{s.municipality}</span>
                <button
                  type="button"
                  onClick={() => setSelectedStation(s)}
                  className="mt-1 text-left text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ver hidrograma completo →
                </button>
              </div>
            </Popup>
          </Marker>
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
              eventHandlers={{
                // Stop the click from bubbling to the map's own click handler
                // (ReachClickLayer), which would otherwise also fire its
                // GEOGLOWS reach lookup underneath this marker's popup.
                click: (e) => L.DomEvent.stopPropagation(e),
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
        <ReachClickLayer enabled={queryReachOnClick} />
        {onBoundsChange && (
          <OverlaySync onBoundsChange={onBoundsChange} onOverlayChange={handleOverlayChange} />
        )}
      </MapContainer>

      <div className="absolute left-3 top-3 z-[400] flex flex-col gap-1.5 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur">
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={queryReachOnClick}
            onChange={(e) => setQueryReachOnClick(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Consultar río al hacer clic (GEOGLOWS)
        </label>
        <div className="my-0.5 h-px bg-border" aria-hidden="true" />
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showSusceptibility}
            onChange={(e) => setShowSusceptibility(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Susceptibilidad a inundación
        </label>
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showPrecipitation}
            onChange={(e) => setShowPrecipitation(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Precipitación (IMERG)
        </label>
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showVeredas}
            onChange={(e) => setShowVeredas(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Modelo propio de inundación (por vereda, incluye Zarzal)
        </label>
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showQuebradas}
            onChange={(e) => setShowQuebradas(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Quebradas y ríos (clic para nombre)
        </label>
        <div className="my-0.5 h-px bg-border" aria-hidden="true" />
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showSettlement}
            onChange={(e) => setShowSettlement(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Asentamientos humanos (GHSL)
        </label>
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showProtectedAreas}
            onChange={(e) => setShowProtectedAreas(e.target.checked)}
            className="size-3.5 accent-[var(--primary)]"
          />
          Áreas protegidas (WDPA)
        </label>
        {showPrecipitation && (
          <a
            href={IMERG_WORLDVIEW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver escala en Worldview
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </div>
      {((showSusceptibility && !susceptibility && !susceptibilityError) ||
        (showQuebradas && !quebradas && !quebradasError)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      <ReturnPeriodLegend />
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      {(showSusceptibility || showVeredas) && (
        <SusceptibilityLegend
          title={
            showSusceptibility && showVeredas
              ? "Susceptibilidad a inundación (zonificación oficial y modelo propio)"
              : showSusceptibility
                ? "Susceptibilidad a inundación (zonificación oficial)"
                : "Amenaza a inundación (modelo propio, por vereda)"
          }
        />
      )}
      {(showSettlement || showProtectedAreas) && (
        <div className="absolute bottom-3 left-56 z-[400] flex flex-col items-start gap-2">
          {showSettlement && <SettlementLegend />}
          {showProtectedAreas && <ProtectedAreasLegend />}
        </div>
      )}

      <StationDetailDialog
        station={selectedStation}
        onOpenChange={(open) => {
          if (!open) setSelectedStation(null)
        }}
      />
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through GeoglowsLiveMapLoader (next/dynamic, ssr: false).
export default GeoglowsLiveMapImpl
