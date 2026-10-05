"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import Map, {
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
import { toast } from "sonner"
import { List } from "lucide-react"
import {
  LAYER_DEFINITIONS,
  LAYER_ORDER,
  resolveSubLayerOn,
  type LabVeredaFeature,
  type LabVeredasFeatureCollection,
  type LayerKey,
} from "@/lib/laboratorio/layers"
import { useLabPoints, MAX_VISIBLE_POINTS, type LabPointFeature } from "@/lib/laboratorio/use-lab-points"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { maplibreMapStyle } from "@/lib/maps/maplibre-basemap-style"
import { useThemeSyncedBasemap } from "@/lib/maps/use-theme-synced-basemap"
import { wmsRasterSource } from "@/lib/maps/wms-raster-source"
import { GWIS_WMS_URL } from "@/lib/incendios/gwis"
import { GWIS_SETTLEMENT_LAYER, GWIS_PROTECTED_AREAS_LAYER } from "@/lib/demografia/gwis-context-layers"
import { IMERG_TILE_URL } from "@/lib/precipitacion/imerg"
import { useOsmInfrastructure } from "@/lib/osm/use-infrastructure"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { identifyReach, returnPeriodColor, returnPeriodLabel, type ReachInfo } from "@/lib/geoglows/live-map"
import { formatFlow } from "@/lib/flood-ui"
import type { InundacionesQuebradasResponse } from "@/lib/inundaciones/api-types"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { VeredaPopupContent, type VeredaPopupHazardKind } from "@/components/maps/vereda-popup-content"
import { PointsListDialog } from "@/components/laboratorio/points-list-dialog"
import { Button } from "@/components/ui/button"
import { isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import { boundsForActiveMunicipios } from "@/lib/veredas/municipio-bounds"

/** The two layers that render as raw point markers instead of a vereda choropleth fill. */
const POINTS_LAYERS: LayerKey[] = ["sismologia", "hidrantes"]

/** The only layer keys `VeredaPopupContent` has dedicated per-hazard fields for. */
const POPUP_HAZARD_KINDS: VeredaPopupHazardKind[] = [
  "deslizamientos",
  "inundaciones",
  "sismologia",
  "incendios",
  "riesgo-compuesto",
]

// Turbopack rewrites maplibre-gl's internal `import.meta.url`-based worker
// resolution into a blob URL, which breaks the worker's own relative asset
// resolution. Pointing at a self-hosted copy of the worker script sidesteps
// that bundler-specific failure mode (same fix as every other MapLibre map).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}

// Same AOI framing as every other MapLibre hazard map in the app (see
// deslizamientos-live-map.tsx) — `[[west, south], [east, north]]`.
const AOI_BOUNDS: [[number, number], [number, number]] = [
  [-76.06, 3.88],
  [-75.72, 4.44],
]

const GRAY_FILL = "#9ca3af"

interface LabMapProps {
  veredas: LabVeredasFeatureCollection | null
  activeLayers: LayerKey[]
  /** A disabled layer currently hovered in the rail — rendered dimmed as a preview, doesn't count toward the 3-layer limit. */
  previewLayer: LayerKey | null
  layerOpacity: Record<LayerKey, number>
  municipio: string | null
  is3D: boolean
  onToggle3D: () => void
  onVeredaSelect: (feature: LabVeredaFeature | null) => void
  /** The single exclusive hazard layer currently selected, if any — sub-layers only apply to this layer. */
  focusLayer: LayerKey | null
  /** Per-sub-layer on/off overrides, keyed by the sub-layer's bare `id` (see `resolveSubLayerOn`). */
  subLayerToggles: Record<string, boolean>
}

const quebradasFetcher = async (url: string): Promise<InundacionesQuebradasResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de quebradas y ríos")
  return res.json()
}

/**
 * Single shared `<Map>` rendering up to 3 hazard fills (plus a hover
 * preview) over the same vereda geometry — the core of the laboratorio
 * prototype. One `Source`+`Layer` pair per hazard layer rather than a
 * single merged source, so each layer's paint (color ramp, opacity) stays
 * fully independent and toggling one never requires recomputing the
 * others' GeoJSON.
 */
export function LabMap({
  veredas,
  activeLayers,
  previewLayer,
  layerOpacity,
  municipio,
  is3D,
  onToggle3D,
  onVeredaSelect,
  focusLayer,
  subLayerToggles,
}: LabMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [basemap, setBasemap] = useThemeSyncedBasemap()
  const [popupInfo, setPopupInfo] = useState<{ feature: LabVeredaFeature; layer: LayerKey } | null>(null)
  const [pointPopup, setPointPopup] = useState<LabPointFeature | null>(null)
  const [pointsModalLayer, setPointsModalLayer] = useState<LayerKey | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [cursor, setCursor] = useState("")
  const [quebradaPopup, setQuebradaPopup] = useState<{ lon: number; lat: number; nombre: string } | null>(null)
  const [reachPopup, setReachPopup] = useState<{ lon: number; lat: number; info: ReachInfo | null } | null>(null)

  // Only the focused layer's own sub-layers can be active — switching away from it (or turning off
  // exclusivity entirely) clears them implicitly since `focusLayer` becomes null/changes.
  const activeSubLayerIds = useMemo(() => {
    if (!focusLayer) return new Set<string>()
    const subLayers = LAYER_DEFINITIONS[focusLayer].subLayers ?? []
    return new Set(subLayers.filter((s) => resolveSubLayerOn(focusLayer, s.id, subLayerToggles)).map((s) => s.id))
  }, [focusLayer, subLayerToggles])

  const { data: quebradasData } = useSWR<InundacionesQuebradasResponse>(
    activeSubLayerIds.has("quebradas") ? "/api/inundaciones/quebradas" : null,
    quebradasFetcher,
    { revalidateOnFocus: false },
  )
  const quebradasGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!quebradasData?.lines) return null
    return {
      type: "FeatureCollection",
      features: quebradasData.lines.features.map((feature, i) => ({ ...feature, id: `quebrada-${i}` })),
    }
  }, [quebradasData])

  const { points: osmInfraPoints } = useOsmInfrastructure()
  const osmColors = useOsmCategoryColors()

  const activePointsLayers = useMemo(
    () => activeLayers.filter((layer) => POINTS_LAYERS.includes(layer)),
    [activeLayers],
  )
  const sismologiaPoints = useLabPoints(
    activeLayers.includes("sismologia") || previewLayer === "sismologia" ? "sismologia" : null,
  )
  const hidrantesPoints = useLabPoints(
    activeLayers.includes("hidrantes") || previewLayer === "hidrantes" ? "hidrantes" : null,
  )
  const pointsForLayer = useCallback(
    (layer: LayerKey) => (layer === "sismologia" ? sismologiaPoints : layer === "hidrantes" ? hidrantesPoints : null),
    [sismologiaPoints, hidrantesPoints],
  )

  // Points layers (sismología, hidrantes) cluster in a small corner of the AOI — hidrantes especially
  // only covers Sevilla's casco urbano, a tiny fraction of the full municipality bounds the map opens
  // on. Without flying to the actual data extent, toggling one on looks like a near-empty map. Flies
  // once per activation (tracked in `flownPointsLayers`), not on every data refresh, and re-arms when
  // the layer is toggled off so re-enabling it flies again.
  const flownPointsLayers = useRef<Set<LayerKey>>(new Set())
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    for (const layer of activePointsLayers) {
      if (flownPointsLayers.current.has(layer)) continue
      const points = pointsForLayer(layer)?.all ?? []
      if (points.length === 0) continue
      flownPointsLayers.current.add(layer)
      const lons = points.map((p) => p.lon)
      const lats = points.map((p) => p.lat)
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 80, duration: 1500, maxZoom: 16 },
      )
    }
    for (const layer of flownPointsLayers.current) {
      if (!activePointsLayers.includes(layer)) flownPointsLayers.current.delete(layer)
    }
  }, [activePointsLayers, pointsForLayer])

  const mapStyle = useMemo(() => maplibreMapStyle(basemap, is3D), [basemap, is3D])

  // `wmsRasterSource`/the IMERG tile URL build a fresh `tiles` array on every call. MapLibre raster
  // sources can't have their `tiles` swapped after creation, so if these specs aren't referentially
  // stable across re-renders (e.g. a cursor-state update from map hover), react-map-gl's `Source`
  // tries to "update" the existing source with what looks like a changed spec and MapLibre's internal
  // assert trips. Memoizing keeps the same object/array identity for the lifetime of each sub-layer.
  const ghslSourceSpec = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_SETTLEMENT_LAYER), [])
  const wdpaSourceSpec = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_PROTECTED_AREAS_LAYER), [])
  const imergTiles = useMemo(() => [IMERG_TILE_URL], [])

  const flyToPoint = useCallback((point: LabPointFeature) => {
    const map = mapRef.current?.getMap()
    if (map) {
      map.easeTo({ center: [point.lon, point.lat], zoom: Math.max(map.getZoom(), 13), duration: 1200 })
    }
    setPointPopup(point)
  }, [])

  const geojsonForLayer = useCallback(
    (layer: LayerKey): LabVeredasFeatureCollection | null => {
      if (!veredas) return null
      const def = LAYER_DEFINITIONS[layer]
      // Only called via `fillLayers` (see render below), which excludes "points" mode layers,
      // so `levelProperty`/`levelStyles` are always defined for any layer reaching this point.
      const levelProperty = def.levelProperty
      const levelStyles = def.levelStyles
      return {
        type: "FeatureCollection",
        features: veredas.features.map((feature) => {
          const inMunicipio = !municipio || isMunicipioActive(feature.properties.municipio, [municipio])
          const level = levelProperty ? (feature.properties[levelProperty] as string | null) : null
          const style = level ? levelStyles?.[level] : undefined
          const color = inMunicipio && style ? resolveCssColor(style.colorToken) : resolveCssColor(GRAY_FILL)
          return {
            ...feature,
            properties: {
              ...feature.properties,
              __fillColor: color,
              __inMunicipio: inMunicipio,
              __hasData: Boolean(style),
            },
          }
        }),
      }
    },
    [veredas, municipio],
  )

  const handleToggle3D = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) {
      onToggle3D()
      return
    }
    const next = !is3D
    setTransitioning(true)
    map.once("moveend", () => {
      setTransitioning(false)
      onToggle3D()
      toast(next ? "Vista 3D activada" : "Vista 2D activada")
    })
    map.easeTo({
      pitch: next ? 60 : 0,
      bearing: next ? 30 : 0,
      duration: 2000,
    })
  }, [is3D, onToggle3D])

  const flyToMunicipio = useCallback(
    (name: string | null) => {
      const map = mapRef.current?.getMap()
      if (!map || !veredas) return
      if (!name) {
        map.fitBounds(AOI_BOUNDS, { padding: 40, duration: 1500 })
        return
      }
      const bounds = boundsForActiveMunicipios(veredas, [name])
      if (!bounds) return
      const [[south, west], [north, east]] = bounds as [[number, number], [number, number]]
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 60, duration: 1800 },
      )
    },
    [veredas],
  )

  // Sismología and hidrantes render as raw point markers (see `activePointsLayers`
  // below) — they have no `levelProperty`/`levelStyles` to paint a choropleth fill
  // with, so they're excluded from the per-layer `Source`/`Layer` loop entirely.
  const fillLayers = useMemo(() => activeLayers.filter((layer) => !POINTS_LAYERS.includes(layer)), [activeLayers])

  const interactiveLayerIds = useMemo(() => {
    const ids = [...fillLayers].reverse().map((layer) => `lab-${layer}-fill`)
    if (activeSubLayerIds.has("quebradas")) ids.push("lab-sub-quebradas-hit")
    return ids
  }, [fillLayers, activeSubLayerIds])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]

      if (feature?.layer?.id === "lab-sub-quebradas-hit") {
        const nombre = (feature.properties?.nombre as string | undefined) ?? "Quebrada / río"
        setQuebradaPopup({ lon: e.lngLat.lng, lat: e.lngLat.lat, nombre })
        return
      }

      if (!feature || !feature.properties) {
        setPopupInfo(null)
        onVeredaSelect(null)
        setQuebradaPopup(null)

        if (activeSubLayerIds.has("geoglows-click")) {
          const map = mapRef.current?.getMap()
          if (map) {
            const bounds = map.getBounds()
            const container = map.getContainer()
            const { lng, lat } = e.lngLat
            identifyReach(
              lat,
              lng,
              { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() },
              container.clientWidth,
              container.clientHeight,
            )
              .then((info) => setReachPopup({ lon: lng, lat, info }))
              .catch(() => setReachPopup({ lon: lng, lat, info: null }))
          }
        } else {
          setReachPopup(null)
        }
        return
      }

      setReachPopup(null)
      const layerId = feature.layer?.id ?? ""
      const layer = LAYER_ORDER.find((key) => `lab-${key}-fill` === layerId)
      const veredaFeature = veredas?.features.find(
        (f) => f.properties.codigoVereda === feature.properties?.codigoVereda,
      )
      if (!veredaFeature || !layer) return
      setPopupInfo({ feature: veredaFeature, layer })
      onVeredaSelect(veredaFeature)
    },
    [veredas, onVeredaSelect, activeSubLayerIds],
  )

  return (
    <div className="relative size-full">
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{ bounds: AOI_BOUNDS, fitBoundsOptions: { padding: 40 } }}
        interactiveLayerIds={interactiveLayerIds}
        onClick={handleMapClick}
        cursor={cursor}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl position="bottom-right" compact />
        <NavigationControl position="top-left" />
        <MapViewToggleControl is3D={is3D} onToggle={handleToggle3D} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} />

        {activeSubLayerIds.has("ghsl") && (
          <Source id="lab-sub-ghsl-source" {...ghslSourceSpec}>
            <Layer id="lab-sub-ghsl-raster" type="raster" paint={{ "raster-opacity": 0.55 }} />
          </Source>
        )}

        {activeSubLayerIds.has("wdpa") && (
          <Source id="lab-sub-wdpa-source" {...wdpaSourceSpec}>
            <Layer id="lab-sub-wdpa-raster" type="raster" paint={{ "raster-opacity": 0.55 }} />
          </Source>
        )}

        {activeSubLayerIds.has("imerg") && (
          <Source id="lab-sub-imerg-source" type="raster" tiles={imergTiles} tileSize={256}>
            <Layer id="lab-sub-imerg-raster" type="raster" paint={{ "raster-opacity": 0.6 }} />
          </Source>
        )}

        {!is3D &&
          fillLayers.map((layer) => {
            const data = geojsonForLayer(layer)
            if (!data) return null
            return (
              <Source key={layer} id={`lab-${layer}-source`} type="geojson" data={data}>
                <Layer
                  id={`lab-${layer}-fill`}
                  type="fill"
                  paint={{
                    "fill-color": ["get", "__fillColor"],
                    "fill-opacity": layerOpacity[layer] ?? 0.55,
                  }}
                />
                <Layer
                  id={`lab-${layer}-line`}
                  type="line"
                  paint={{ "line-color": "rgba(0,0,0,0.25)", "line-width": 0.5 }}
                />
              </Source>
            )
          })}

        {quebradasGeoJson && (
          <Source id="lab-sub-quebradas-source" type="geojson" data={quebradasGeoJson}>
            <Layer id="lab-sub-quebradas-line" type="line" paint={{ "line-color": "#0ea5e9", "line-width": 1.5 }} />
            <Layer
              id="lab-sub-quebradas-hit"
              type="line"
              paint={{ "line-color": "#0ea5e9", "line-width": 14, "line-opacity": 0 }}
            />
          </Source>
        )}

        {(() => {
          const previewData = !is3D && previewLayer && !activeLayers.includes(previewLayer)
            ? geojsonForLayer(previewLayer)
            : null
          if (!previewData || !previewLayer) return null
          return (
            <Source id={`lab-preview-${previewLayer}-source`} type="geojson" data={previewData}>
              <Layer
                id={`lab-preview-${previewLayer}-fill`}
                type="fill"
                paint={{ "fill-color": ["get", "__fillColor"], "fill-opacity": 0.35 }}
              />
            </Source>
          )
        })()}

        {popupInfo && (
          <Popup
            key={popupInfo.feature.properties.codigoVereda}
            longitude={centroidOf(popupInfo.feature)[0]}
            latitude={centroidOf(popupInfo.feature)[1]}
            onClose={() => {
              setPopupInfo(null)
              onVeredaSelect(null)
            }}
            closeOnClick={false}
            maxWidth="260px"
          >
            <VeredaPopupContent
              feature={popupInfo.feature}
              // `VeredaPopupContent` only has dedicated fields for these 4 hazard models — "precipitacion",
              // "clima", and "demografia" fall back to the shared population/infrastructure summary only.
              hazardKind={
                POPUP_HAZARD_KINDS.includes(popupInfo.layer as (typeof POPUP_HAZARD_KINDS)[number])
                  ? (popupInfo.layer as VeredaPopupHazardKind)
                  : undefined
              }
              colored={POPUP_HAZARD_KINDS.includes(popupInfo.layer as (typeof POPUP_HAZARD_KINDS)[number])}
            />
          </Popup>
        )}

        {activeSubLayerIds.has("osm-infra") &&
          osmInfraPoints?.map((point, i) => {
            const category = getOsmCategory(point.category)
            const color = osmColors?.[point.category] ?? "#9ca3af"
            return (
              <Marker key={`osm-${i}`} longitude={point.lon} latitude={point.lat}>
                <span
                  className="block size-2.5 rounded-full border border-background shadow-sm"
                  style={{ backgroundColor: color }}
                  aria-label={`${category.label}: ${point.name ?? "sin nombre"}`}
                />
              </Marker>
            )
          })}

        {quebradaPopup && (
          <Popup
            longitude={quebradaPopup.lon}
            latitude={quebradaPopup.lat}
            onClose={() => setQuebradaPopup(null)}
            closeOnClick={false}
            maxWidth="220px"
          >
            <p className="text-sm font-semibold text-foreground">{quebradaPopup.nombre}</p>
          </Popup>
        )}

        {reachPopup && (
          <Popup
            longitude={reachPopup.lon}
            latitude={reachPopup.lat}
            onClose={() => setReachPopup(null)}
            closeOnClick={false}
            maxWidth="240px"
          >
            {reachPopup.info ? (
              <div className="flex flex-col gap-1 p-1 text-sm">
                <p className="font-semibold" style={{ color: returnPeriodColor(reachPopup.info.returnPeriod) }}>
                  {returnPeriodLabel(reachPopup.info.returnPeriod)}
                </p>
                {reachPopup.info.meanFlowCms != null && (
                  <p className="text-muted-foreground">Caudal medio: {formatFlow(reachPopup.info.meanFlowCms)}</p>
                )}
                <p className="text-xs text-muted-foreground">Fuente: GEOGLOWS</p>
              </div>
            ) : (
              <p className="p-1 text-xs text-muted-foreground">Sin tramo de río en este punto.</p>
            )}
          </Popup>
        )}

        {activePointsLayers.map((layer) =>
          (pointsForLayer(layer)?.visible ?? []).map((point) => (
            <Marker
              key={point.id}
              longitude={point.lon}
              latitude={point.lat}
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setPointPopup(point)
              }}
            >
              <span
                className="block size-3 cursor-pointer rounded-full border border-background shadow-sm"
                style={{ backgroundColor: `var(--${point.colorToken})`, width: point.radius * 2, height: point.radius * 2 }}
                aria-label={point.label}
              />
            </Marker>
          )),
        )}

        {pointPopup && (
          <Popup
            key={pointPopup.id}
            longitude={pointPopup.lon}
            latitude={pointPopup.lat}
            onClose={() => setPointPopup(null)}
            closeOnClick={false}
            maxWidth="240px"
          >
            <div className="flex flex-col gap-1 p-1">
              <p className="text-sm font-semibold text-foreground">{pointPopup.label}</p>
              <p className="text-xs text-muted-foreground">{pointPopup.sublabel}</p>
            </div>
          </Popup>
        )}
      </Map>

      {activePointsLayers.length > 0 && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-2">
          {activePointsLayers.map((layer) => {
            const data = pointsForLayer(layer)
            if (!data || data.all.length === 0) return null
            return (
              <Button
                key={layer}
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5 shadow-md"
                onClick={() => setPointsModalLayer(layer)}
              >
                <List className="size-3.5" aria-hidden="true" />
                Ver todas · {LAYER_DEFINITIONS[layer].shortLabel} ({data.all.length})
              </Button>
            )
          })}
        </div>
      )}

      {pointsModalLayer &&
        (() => {
          const data = pointsForLayer(pointsModalLayer)
          if (!data) return null
          return (
            <PointsListDialog
              open
              onOpenChange={(open) => !open && setPointsModalLayer(null)}
              title={LAYER_DEFINITIONS[pointsModalLayer].label}
              points={data.all}
              visibleCount={MAX_VISIBLE_POINTS}
              onSelect={flyToPoint}
            />
          )
        })()}

      {transitioning && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/30 backdrop-blur-sm">
          <p className="rounded-full bg-card/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
            Generando vista 3D…
          </p>
        </div>
      )}

      {/* Exposed for the workspace's municipio selector via a DOM-free ref callback pattern would be cleaner,
          but `flyToMunicipio` needs the live MapRef — the workspace calls back into this via the `municipio`
          prop change below instead of a hoisted imperative handle, keeping this component's public surface
          to plain props. */}
      <MunicipioFlyToEffect municipio={municipio} onFly={flyToMunicipio} />
    </div>
  )
}

/** Fires `onFly` whenever `municipio` changes, without exposing the map's imperative handle to the parent. */
function MunicipioFlyToEffect({ municipio, onFly }: { municipio: string | null; onFly: (name: string | null) => void }) {
  const previous = useRef<string | null | undefined>(undefined)
  if (previous.current !== municipio) {
    previous.current = municipio
    // Scheduled on the next tick so it runs after the map has (re)rendered its current sources.
    queueMicrotask(() => onFly(municipio))
  }
  return null
}

function centroidOf(feature: LabVeredaFeature): [number, number] {
  let sumLon = 0
  let sumLat = 0
  let count = 0
  for (const polygon of feature.geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        sumLon += lon
        sumLat += lat
        count++
      }
    }
  }
  return count > 0 ? [sumLon / count, sumLat / count] : [-75.93, 4.27]
}
