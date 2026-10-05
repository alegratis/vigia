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
import { List, MapPin } from "lucide-react"
import {
  LAYER_DEFINITIONS,
  LAYER_ORDER,
  resolveSubLayerOn,
  type LabVeredaFeature,
  type LabVeredasFeatureCollection,
  type LayerKey,
} from "@/lib/laboratorio/layers"
import { useLabPoints, MAX_VISIBLE_POINTS, type LabPointFeature } from "@/lib/laboratorio/use-lab-points"
import { COVERAGE_DENSITY_COLOR_EXPRESSION, type HidrantesExperience } from "@/lib/laboratorio/use-hidrantes-experience"
import {
  DEMOGRAFIA_SOURCE_ID,
  DEMOGRAFIA_LAYER_ID,
  MANZANA_FIELD_LABEL,
  type DemografiaExperience,
} from "@/lib/laboratorio/use-demografia-experience"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { maplibreMapStyle } from "@/lib/maps/maplibre-basemap-style"
import { useThemeSyncedBasemap } from "@/lib/maps/use-theme-synced-basemap"
import { wmsRasterSource } from "@/lib/maps/wms-raster-source"
import { GWIS_WMS_URL } from "@/lib/incendios/gwis"
import { GWIS_SETTLEMENT_LAYER, GWIS_PROTECTED_AREAS_LAYER } from "@/lib/demografia/gwis-context-layers"
import { SEVILLA_CASCO_URBANO_BOUNDS } from "@/lib/demografia/geo-detect"
import { IMERG_TILE_URL } from "@/lib/precipitacion/imerg"
import { useOsmInfrastructure } from "@/lib/osm/use-infrastructure"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { SENSITIVE_SITE_STYLES, type SensitiveSiteFeature } from "@/lib/osm/sensitive-sites"
import { identifyReach, returnPeriodColor, returnPeriodLabel, type ReachInfo } from "@/lib/geoglows/live-map"
import { formatFlow } from "@/lib/flood-ui"
import type { InundacionesQuebradasResponse } from "@/lib/inundaciones/api-types"
import type { HidranteFeature } from "@/lib/hidrantes/api-types"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { VeredaPopupContent, type VeredaPopupHazardKind } from "@/components/maps/vereda-popup-content"
import { DemografiaPopupContent } from "@/components/maps/demografia-popup-content"
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
  /** Geolocation/routing/coverage state for the hidrantes layer, lifted to the workspace so the context panel's rail controls and this map's rendering share one source of truth. */
  hidrantesExperience: HidrantesExperience
  /** Indicator-switching state (vulnerabilidad/pobreza/manzanas) for the demografía layer, lifted to the workspace for the same reason as `hidrantesExperience`. */
  demografiaExperience: DemografiaExperience
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
  hidrantesExperience,
  demografiaExperience,
}: LabMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [basemap, setBasemap] = useThemeSyncedBasemap()
  const [popupInfo, setPopupInfo] = useState<{ feature: LabVeredaFeature; layer: LayerKey } | null>(null)
  const [pointPopup, setPointPopup] = useState<LabPointFeature | null>(null)
  const [pointsModalLayer, setPointsModalLayer] = useState<LayerKey | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [cursor, setCursor] = useState("")
  const [quebradaPopup, setQuebradaPopup] = useState<{ lon: number; lat: number; nombre: string } | null>(null)
  const [demografiaPopup, setDemografiaPopup] = useState<{
    lon: number
    lat: number
    properties: Record<string, unknown>
  } | null>(null)
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

  // "hidrantes" is deliberately excluded here: it gets its own dedicated circle-layer rendering,
  // popups, and casco-urbano fitBounds below (see the `focusLayer === "hidrantes"` block and the
  // `flownCascoUrbanoLayers` effect) instead of the generic Marker-per-point treatment sismología
  // uses, since it needs highlight colors driven by distance/route ranking rather than a flat dot.
  const activePointsLayers = useMemo(
    () => activeLayers.filter((layer) => POINTS_LAYERS.includes(layer) && layer !== "hidrantes"),
    [activeLayers],
  )
  const sismologiaPoints = useLabPoints(
    activeLayers.includes("sismologia") || previewLayer === "sismologia" ? "sismologia" : null,
  )
  const hidrantesPoints = useLabPoints(previewLayer === "hidrantes" ? "hidrantes" : null)
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

  // Demografía and hidrantes both only have meaningful data over Sevilla's casco urbano (hidrantes'
  // data literally doesn't exist elsewhere; demografía's per-vereda view is most legible zoomed into
  // the dense urban core). Focusing either one transitions straight into the 3D topographic view and
  // flies to that extent, instead of leaving the user to find it manually — same "fly once per
  // activation" bookkeeping as `flownPointsLayers` below, keyed by layer so re-focusing re-triggers it.
  const flownCascoUrbanoLayers = useRef<Set<LayerKey>>(new Set())
  useEffect(() => {
    const cascoUrbanoLayers: LayerKey[] = ["demografia", "hidrantes"]
    if (!focusLayer || !cascoUrbanoLayers.includes(focusLayer)) {
      for (const layer of cascoUrbanoLayers) flownCascoUrbanoLayers.current.delete(layer)
      return
    }
    if (flownCascoUrbanoLayers.current.has(focusLayer)) return

    // The map/style can still be initializing on a fresh load that starts with this layer already
    // active (e.g. a shared view URL). If we marked `focusLayer` as flown before confirming the map
    // exists, a null map here would skip the fly-in forever, since nothing else in this effect's
    // dependency array changes once the map finishes loading. Retry every render until it's ready,
    // and only mark it flown once the fly-in has actually been issued.
    const map = mapRef.current?.getMap()
    if (!map) return
    flownCascoUrbanoLayers.current.add(focusLayer)

    if (!is3D) {
      setTransitioning(true)
      map.once("moveend", () => {
        setTransitioning(false)
        onToggle3D()
      })
      map.easeTo({ pitch: 60, bearing: 30, duration: 2000 })
    }
    const [[west, south], [east, north]] = SEVILLA_CASCO_URBANO_BOUNDS
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 60, duration: 2000 },
    )
  }, [focusLayer, is3D, onToggle3D])

  // Recenter on the reference point (geolocation fix or map click) once the casco-urbano fly-in above
  // has settled — skipped while that one's still in flight so the two don't fight over the camera.
  const flownReferencePoint = useRef<{ lat: number; lon: number } | null>(null)
  useEffect(() => {
    const ref = hidrantesExperience.referencePoint
    if (focusLayer !== "hidrantes" || !ref || flownCascoUrbanoLayers.current.size === 0) return
    if (flownReferencePoint.current?.lat === ref.lat && flownReferencePoint.current?.lon === ref.lon) return
    flownReferencePoint.current = { lat: ref.lat, lon: ref.lon }
    const map = mapRef.current?.getMap()
    if (!map) return
    map.easeTo({ center: [ref.lon, ref.lat], zoom: Math.max(map.getZoom(), 15), duration: 1200 })
  }, [hidrantesExperience.referencePoint, focusLayer])

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
  // "demografia" is also excluded: it gets its own dedicated fill-extrusion columns
  // driven by `demografiaExperience`'s indicator switch (pobreza/manzanas/vulnerabilidad)
  // instead of the flat population choropleth the generic loop would otherwise paint.
  const fillLayers = useMemo(
    () => activeLayers.filter((layer) => !POINTS_LAYERS.includes(layer) && layer !== "demografia"),
    [activeLayers],
  )

  const interactiveLayerIds = useMemo(() => {
    const ids = [...fillLayers].reverse().map((layer) => `lab-${layer}-fill`)
    if (activeSubLayerIds.has("quebradas")) ids.push("lab-sub-quebradas-hit")
    if (focusLayer === "hidrantes") ids.push("lab-hidrantes-points", "lab-sensitive-sites-fill")
    if (activeLayers.includes("demografia")) ids.push(DEMOGRAFIA_LAYER_ID)
    return ids
  }, [fillLayers, activeSubLayerIds, focusLayer, activeLayers])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]

      if (feature?.layer?.id === "lab-sub-quebradas-hit") {
        const nombre = (feature.properties?.nombre as string | undefined) ?? "Quebrada / río"
        setQuebradaPopup({ lon: e.lngLat.lng, lat: e.lngLat.lat, nombre })
        return
      }

      if (feature?.layer?.id === "lab-hidrantes-points") {
        hidrantesExperience.setPopupSite(null)
        hidrantesExperience.setPopupHidrante(feature as unknown as HidranteFeature)
        return
      }

      if (feature?.layer?.id === "lab-sensitive-sites-fill") {
        hidrantesExperience.setPopupHidrante(null)
        hidrantesExperience.setPopupSite(feature as unknown as SensitiveSiteFeature)
        return
      }

      if (feature?.layer?.id === DEMOGRAFIA_LAYER_ID) {
        setDemografiaPopup({ lon: e.lngLat.lng, lat: e.lngLat.lat, properties: feature.properties ?? {} })
        return
      }

      if (!feature || !feature.properties) {
        setPopupInfo(null)
        onVeredaSelect(null)
        setQuebradaPopup(null)
        setDemografiaPopup(null)

        if (focusLayer === "hidrantes") {
          hidrantesExperience.setPopupHidrante(null)
          hidrantesExperience.setPopupSite(null)
          hidrantesExperience.setClickedPoint({ lat: e.lngLat.lat, lon: e.lngLat.lng })
          return
        }

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

        {activeLayers.includes("demografia") && (
          <>
            {/* Always mounted (not conditioned on data having arrived yet) with a stable
                source/layer id pair — see `DEMOGRAFIA_SOURCE_ID`/`DEMOGRAFIA_LAYER_ID`'s doc
                comment for why the id must never change across indicator switches. */}
            <Source id={DEMOGRAFIA_SOURCE_ID} type="geojson" data={demografiaExperience.activeGeoJson}>
              <Layer
                id={DEMOGRAFIA_LAYER_ID}
                type="fill-extrusion"
                paint={{
                  "fill-extrusion-height": ["coalesce", ["get", "__height"], 0],
                  "fill-extrusion-base": 0,
                  "fill-extrusion-color": ["coalesce", ["get", "__color"], GRAY_FILL],
                  "fill-extrusion-opacity": layerOpacity.demografia ?? 0.85,
                }}
              />
            </Source>

            {demografiaPopup && (
              <Popup
                longitude={demografiaPopup.lon}
                latitude={demografiaPopup.lat}
                onClose={() => setDemografiaPopup(null)}
                closeButton
                closeOnClick={false}
                maxWidth="240px"
              >
                <DemografiaPopupContent indicator={demografiaExperience.indicator} properties={demografiaPopup.properties} />
              </Popup>
            )}
          </>
        )}

        {focusLayer === "hidrantes" && (
          <>
            {hidrantesExperience.distanceRouteGeoJson && (
              <Source id="lab-hidrantes-route-distance-source" type="geojson" data={hidrantesExperience.distanceRouteGeoJson}>
                <Layer
                  id="lab-hidrantes-route-distance-line"
                  type="line"
                  paint={{
                    "line-color": "#f59e0b",
                    "line-width": 4,
                    "line-opacity": 0.85,
                    "line-dasharray":
                      hidrantesExperience.distanceRoute && !hidrantesExperience.distanceRoute.followsStreets
                        ? [1, 1.5]
                        : [1, 0],
                  }}
                />
              </Source>
            )}

            {hidrantesExperience.routeRouteGeoJson && (
              <Source id="lab-hidrantes-route-fastest-source" type="geojson" data={hidrantesExperience.routeRouteGeoJson}>
                <Layer
                  id="lab-hidrantes-route-fastest-line"
                  type="line"
                  paint={{
                    "line-color": "#16a34a",
                    "line-width": 4,
                    "line-opacity": 0.85,
                    "line-dasharray":
                      hidrantesExperience.routeRoute && !hidrantesExperience.routeRoute.followsStreets ? [1, 1.5] : [1, 0],
                  }}
                />
              </Source>
            )}

            {hidrantesExperience.selectedRouteGeoJson && (
              <Source id="lab-hidrantes-route-selected-source" type="geojson" data={hidrantesExperience.selectedRouteGeoJson}>
                <Layer
                  id="lab-hidrantes-route-selected-line"
                  type="line"
                  paint={{
                    "line-color": "#7c3aed",
                    "line-width": 4,
                    "line-opacity": 0.85,
                    "line-dasharray":
                      hidrantesExperience.selectedRoute && !hidrantesExperience.selectedRoute.followsStreets
                        ? [1, 1.5]
                        : [1, 0],
                  }}
                />
              </Source>
            )}

            {hidrantesExperience.coverageGeoJson && (
              <Source id="lab-hidrantes-coverage-source" type="geojson" data={hidrantesExperience.coverageGeoJson}>
                <Layer
                  id="lab-hidrantes-coverage-fill"
                  type="fill"
                  paint={{ "fill-color": COVERAGE_DENSITY_COLOR_EXPRESSION, "fill-opacity": 0.22 }}
                />
                <Layer
                  id="lab-hidrantes-coverage-outline"
                  type="line"
                  paint={{ "line-color": COVERAGE_DENSITY_COLOR_EXPRESSION, "line-width": 1, "line-opacity": 0.6 }}
                />
              </Source>
            )}

            {hidrantesExperience.sensitiveSitePolygons && hidrantesExperience.sensitiveSitePolygons.features.length > 0 && (
              <Source id="lab-sensitive-sites-polygons-source" type="geojson" data={hidrantesExperience.sensitiveSitePolygons}>
                <Layer
                  id="lab-sensitive-sites-fill"
                  type="fill"
                  paint={{
                    "fill-color": [
                      "match",
                      ["get", "category"],
                      "educacion",
                      SENSITIVE_SITE_STYLES[0].color,
                      "salud",
                      SENSITIVE_SITE_STYLES[1].color,
                      "gobierno",
                      SENSITIVE_SITE_STYLES[2].color,
                      SENSITIVE_SITE_STYLES[0].color,
                    ],
                    "fill-opacity": 0.35,
                  }}
                />
                <Layer
                  id="lab-sensitive-sites-outline"
                  type="line"
                  paint={{
                    "line-color": [
                      "match",
                      ["get", "category"],
                      "educacion",
                      SENSITIVE_SITE_STYLES[0].color,
                      "salud",
                      SENSITIVE_SITE_STYLES[1].color,
                      "gobierno",
                      SENSITIVE_SITE_STYLES[2].color,
                      SENSITIVE_SITE_STYLES[0].color,
                    ],
                    "line-width": 2,
                  }}
                />
              </Source>
            )}

            <Source id="lab-hidrantes-source" type="geojson" data={hidrantesExperience.hidrantesGeoJson}>
              <Layer
                id="lab-hidrantes-points"
                type="circle"
                paint={{
                  "circle-radius": ["match", ["get", "__highlight"], "selected", 11, "none", 6, 9],
                  "circle-color": [
                    "match",
                    ["get", "__highlight"],
                    "selected",
                    "#7c3aed",
                    "both",
                    "#f59e0b",
                    "distance",
                    "#f59e0b",
                    "route",
                    "#16a34a",
                    "#dc2626",
                  ],
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": ["match", ["get", "__highlight"], "none", 1.5, 3],
                }}
              />
            </Source>

            {hidrantesExperience.referencePoint && (
              <Marker
                longitude={hidrantesExperience.referencePoint.lon}
                latitude={hidrantesExperience.referencePoint.lat}
                anchor="bottom"
              >
                <div className="flex flex-col items-center">
                  <MapPin className="size-7 fill-blue-500 text-white drop-shadow" aria-hidden="true" />
                  <span className="sr-only">
                    {hidrantesExperience.referencePoint.fromGeolocation ? "Tu ubicación" : "Punto seleccionado"}
                  </span>
                </div>
              </Marker>
            )}

            {hidrantesExperience.popupHidrante && (
              <Popup
                longitude={hidrantesExperience.popupHidrante.geometry.coordinates[0]}
                latitude={hidrantesExperience.popupHidrante.geometry.coordinates[1]}
                onClose={() => hidrantesExperience.setPopupHidrante(null)}
                closeButton
                closeOnClick={false}
              >
                <div className="flex flex-col gap-1 text-sm">
                  <strong className="text-foreground">
                    {hidrantesExperience.popupHidrante.properties.nombre ?? "Hidrante"}
                  </strong>
                  {hidrantesExperience.popupHidrante.properties.direccion && (
                    <span className="text-muted-foreground">{hidrantesExperience.popupHidrante.properties.direccion}</span>
                  )}
                  {hidrantesExperience.popupHidrante.properties.tipo && (
                    <span className="text-muted-foreground">{hidrantesExperience.popupHidrante.properties.tipo}</span>
                  )}
                  {hidrantesExperience.popupHidrante.properties.muestra && (
                    <span className="text-amber-600 dark:text-amber-500">
                      Dato de muestra — no corresponde a un hidrante real
                    </span>
                  )}
                  {hidrantesExperience.referencePoint &&
                    typeof hidrantesExperience.popupHidrante.properties.__index === "number" && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-1 w-fit"
                        onClick={() => {
                          hidrantesExperience.setSelectedIndex(hidrantesExperience.popupHidrante!.properties.__index as number)
                          hidrantesExperience.setPopupHidrante(null)
                        }}
                      >
                        Dirígeme a este hidrante
                      </Button>
                    )}
                </div>
              </Popup>
            )}

            {hidrantesExperience.popupSite &&
              (() => {
                const site = hidrantesExperience.popupSite
                const coords =
                  site.geometry.type === "Point"
                    ? (site.geometry.coordinates as [number, number])
                    : (() => {
                        let sumLon = 0
                        let sumLat = 0
                        let count = 0
                        const geom = site.geometry as GeoJSON.Polygon
                        for (const ring of geom.coordinates) {
                          for (const [lon, lat] of ring) {
                            sumLon += lon
                            sumLat += lat
                            count++
                          }
                        }
                        return count > 0 ? ([sumLon / count, sumLat / count] as [number, number]) : [-75.93, 4.27]
                      })()
                const style = SENSITIVE_SITE_STYLES.find((s) => s.key === site.properties.category) ?? SENSITIVE_SITE_STYLES[0]
                return (
                  <Popup
                    longitude={coords[0]}
                    latitude={coords[1]}
                    onClose={() => hidrantesExperience.setPopupSite(null)}
                    closeButton
                    closeOnClick={false}
                  >
                    <div className="flex flex-col gap-1 text-sm">
                      <strong className="text-foreground">{site.properties.name ?? style.label}</strong>
                      <span style={{ color: style.color }}>{style.label}</span>
                      <span className="text-xs text-muted-foreground">
                        Los hidrantes cercanos usan un radio de cobertura reducido.
                      </span>
                    </div>
                  </Popup>
                )
              })()}
          </>
        )}

        {(() => {
          const previewData = !is3D && previewLayer && !activeLayers.includes(previewLayer)
            ? geojsonForLayer(previewLayer)
            : null
          if (!previewData || !previewLayer) return null
          return (
            // `key` forces a fresh `<Source>` instance per layer — without it, react-map-gl reuses the
            // same instance across renders (matched by JSX position, not by the `id` prop) and tries to
            // "update" a mounted source with a different `id`, which trips MapLibre's own assertion that
            // a source's `id`/`type` never change in place.
            <Source key={previewLayer} id={`lab-preview-${previewLayer}-source`} type="geojson" data={previewData}>
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
