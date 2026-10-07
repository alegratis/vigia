"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  resolveOption,
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
import { useFaults } from "@/lib/deslizamientos/use-faults"
import { useSismologiaDanos, useSismologiaEventos } from "@/lib/sismologia/use-sismologia"
import {
  SEISMIC_MAGNITUDE_LEVELS,
  SEISMIC_MAGNITUDE_LEVEL_STYLES,
  SEISMIC_EXPOSURE_LEVEL_TOKENS,
  magnitudeLevel,
  magnitudeRadius,
  seismicExposureLevel,
} from "@/lib/sismologia/levels"
import { DAMAGE_LEVEL_ORDER, DAMAGE_LEVEL_LABEL, DAMAGE_LEVEL_COLOR_TOKEN, type DamageLevel } from "@/lib/sismologia/damage-levels"
import { GWIS_FWI_LAYER, GWIS_S3_HOTSPOT_LAYER } from "@/lib/incendios/gwis"
import { GWIS_LANDCOVER_LAYER } from "@/lib/land-cover/gwis-landcover"
import { CONFIDENCE_STYLES, formatDateTime, formatDistance, formatFrp } from "@/lib/firms/ui"
import { FIRE_THREAT_LEVELS } from "@/lib/incendios/levels"
import type { SeismicEvent } from "@/lib/sismologia/api-types"
import type { FireDetection, FiresResponse } from "@/lib/firms/api-types"
import type { MapBounds } from "@/lib/map-bounds"

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
  /** Single-choice select values (time window, forecast day...), keyed by `LayerOption.id`. */
  optionValues: Record<string, string>
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
  optionValues,
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

  // On mobile the layer rail/navigation covers the left edge, so the map controls move to the right.
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  const controlsPosition = isMobile ? "top-right" : "top-left"

  const [viewportBounds, setViewportBounds] = useState<MapBounds | null>(null)
  const [damageClustered, setDamageClustered] = useState(true)
  const [featurePopup, setFeaturePopup] = useState<{ lon: number; lat: number; content: ReactNode } | null>(null)
  const [resolved, setResolved] = useState<{
    magnitude: Record<string, string>
    exposure: Record<string, string>
    damage: Record<DamageLevel, string>
    fire: Record<FireDetection["confidence"], string>
    fault: string
  } | null>(null)
  useEffect(() => {
    setResolved({
      magnitude: Object.fromEntries(
        SEISMIC_MAGNITUDE_LEVELS.map((l) => [l, resolveCssColor(SEISMIC_MAGNITUDE_LEVEL_STYLES[l].colorToken)]),
      ),
      exposure: Object.fromEntries(
        Object.entries(SEISMIC_EXPOSURE_LEVEL_TOKENS).map(([l, token]) => [l, resolveCssColor(token)]),
      ),
      damage: Object.fromEntries(
        DAMAGE_LEVEL_ORDER.map((l) => [l, resolveCssColor(DAMAGE_LEVEL_COLOR_TOKEN[l])]),
      ) as Record<DamageLevel, string>,
      fire: Object.fromEntries(
        (Object.keys(CONFIDENCE_STYLES) as FireDetection["confidence"][]).map((k) => [
          k,
          resolveCssColor(CONFIDENCE_STYLES[k].color),
        ]),
      ) as Record<FireDetection["confidence"], string>,
      fault: resolveCssColor("var(--foreground)"),
    })
  }, [])

  // --- Sismología: epicenters by source, veredas by seismic exposure, geological faults, damage columns.
  const sismoActive = activeLayers.includes("sismologia")
  const sismoWindow = resolveOption("sismologia", "sismo-window", optionValues)
  const { data: sismoData } = useSismologiaEventos()
  const { data: damageData } = useSismologiaDanos(sismoActive && activeSubLayerIds.has("damage"))
  const { traces: faultTraces } = useFaults(sismoActive && activeSubLayerIds.has("faults"), viewportBounds)

  const sismoEventsGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!sismoActive || !sismoData || !resolved) return { type: "FeatureCollection", features: [] }
    const list: SeismicEvent[] = []
    if (activeSubLayerIds.has("sismo-sgc")) list.push(...sismoData.sgc.events)
    if (activeSubLayerIds.has("sismo-usgs")) list.push(...sismoData.usgs.events)
    if (activeSubLayerIds.has("sismo-sgc-live")) list.push(...sismoData.sgcLive.events)
    const cutoff = sismoWindow === "all" ? 0 : Date.now() - Number(sismoWindow) * 86_400_000
    return {
      type: "FeatureCollection",
      features: list
        .filter((event) => cutoff === 0 || event.source !== "sgc" || new Date(event.time).getTime() >= cutoff)
        .map((event) => {
          const color = resolved.magnitude[magnitudeLevel(event.magnitude)]
          const paint =
            event.source === "sgc-live"
              ? { strokeColor: "#ffffff", strokeWidth: 1, fillColor: color, fillOpacity: 0.85 }
              : event.source === "usgs"
                ? { strokeColor: color, strokeWidth: 2, fillColor: color, fillOpacity: 0.35 }
                : { strokeColor: color, strokeWidth: 2, fillColor: color, fillOpacity: 0.15 }
          return {
            type: "Feature" as const,
            id: event.id,
            properties: { ...event, __radius: magnitudeRadius(event.magnitude), ...paint },
            geometry: { type: "Point" as const, coordinates: [event.lon, event.lat] },
          }
        }),
    }
  }, [sismoActive, sismoData, resolved, activeSubLayerIds, sismoWindow])

  const faultsGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!faultTraces) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: faultTraces.flatMap((trace) =>
        trace.paths.map((path, i) => ({
          type: "Feature" as const,
          id: `${trace.id}-${i}`,
          properties: { nombre: trace.nombre, tipo: trace.tipo },
          geometry: { type: "LineString" as const, coordinates: path },
        })),
      ),
    }
  }, [faultTraces])

  const damageColumnsGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!damageData || !resolved) return { type: "FeatureCollection", features: [] }
    const metersPerDegLat = 111_320
    const square = (lon: number, lat: number, half: number): number[][] => {
      const dLat = half / metersPerDegLat
      const dLon = half / (metersPerDegLat * Math.cos((lat * Math.PI) / 180))
      return [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ]
    }
    const row = (
      id: string,
      label: string,
      lat: number,
      lon: number,
      porNivel: Record<DamageLevel, number>,
      maxCount: number,
      o: { max: number; min: number; half: number; spacing: number },
    ): GeoJSON.Feature[] => {
      const levels = DAMAGE_LEVEL_ORDER.filter((l) => porNivel[l] > 0)
      const metersPerDegLon = metersPerDegLat * Math.cos((lat * Math.PI) / 180)
      const offset = ((levels.length - 1) * o.spacing) / 2
      return levels.map((level, i) => ({
        type: "Feature",
        id: `${id}-${level}`,
        properties: {
          barrio: label,
          nivelLabel: DAMAGE_LEVEL_LABEL[level],
          count: porNivel[level],
          __height: o.min + (porNivel[level] / maxCount) * (o.max - o.min),
          __color: resolved.damage[level],
        },
        geometry: { type: "Polygon", coordinates: [square(lon + (i * o.spacing - offset) / metersPerDegLon, lat, o.half)] },
      }))
    }
    if (damageClustered) {
      const total: Record<DamageLevel, number> = { destruida: 0, danada: 0, posible: 0 }
      let wLat = 0
      let wLon = 0
      for (const b of damageData.barrios) {
        for (const l of DAMAGE_LEVEL_ORDER) total[l] += b.porNivel[l]
        wLat += b.lat * b.totalReportes
        wLon += b.lon * b.totalReportes
      }
      if (damageData.totalReportes > 0) {
        wLat /= damageData.totalReportes
        wLon /= damageData.totalReportes
      }
      const maxCount = Math.max(1, ...DAMAGE_LEVEL_ORDER.map((l) => total[l]))
      return {
        type: "FeatureCollection",
        features: row("sevilla-total", "Sevilla (todos los barrios)", wLat, wLon, total, maxCount, {
          max: 900,
          min: 60,
          half: 55,
          spacing: 160,
        }),
      }
    }
    const maxCount = Math.max(1, ...damageData.barrios.flatMap((b) => DAMAGE_LEVEL_ORDER.map((l) => b.porNivel[l])))
    return {
      type: "FeatureCollection",
      features: damageData.barrios.flatMap((b) =>
        row(b.barrio, b.barrio, b.lat, b.lon, b.porNivel, maxCount, { max: 420, min: 24, half: 14, spacing: 42 }),
      ),
    }
  }, [damageData, resolved, damageClustered])

  // --- Incendios: NASA FIRMS active fires (MODIS/VIIRS) and GWIS raster overlays.
  const incendiosFocus = focusLayer === "incendios" && activeLayers.includes("incendios")
  const fireDays = resolveOption("incendios", "fire-days", optionValues)
  const fwiDay = resolveOption("incendios", "fwi-day", optionValues)
  const showModis = incendiosFocus && activeSubLayerIds.has("fires-modis")
  const showViirs = incendiosFocus && activeSubLayerIds.has("fires-viirs")
  const { data: firesData } = useSWR<FiresResponse>(
    showModis || showViirs ? `/api/incendios?days=${fireDays}` : null,
    async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("No se pudo cargar los focos activos de NASA FIRMS")
      return res.json()
    },
    { revalidateOnFocus: false },
  )
  const firesGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!firesData || !resolved) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: firesData.detections
        .filter((d) => (d.sensor === "modis" ? showModis : showViirs))
        .map((d) => ({
          type: "Feature" as const,
          id: d.id,
          properties: {
            ...d,
            __color: resolved.fire[d.confidence],
            __radius: Math.min(11, Math.max(4, 4 + Math.sqrt(d.frp) / 2)),
          },
          geometry: { type: "Point" as const, coordinates: [d.lon, d.lat] },
        })),
    }
  }, [firesData, resolved, showModis, showViirs])
  const fwiSourceSpec = useMemo(
    () => wmsRasterSource(GWIS_WMS_URL, GWIS_FWI_LAYER, fwiDay ? { TIME: fwiDay } : {}),
    [fwiDay],
  )
  const sentinel3SourceSpec = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_S3_HOTSPOT_LAYER), [])
  const landCoverSourceSpec = useMemo(() => wmsRasterSource(GWIS_WMS_URL, GWIS_LANDCOVER_LAYER), [])

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
  const hidrantesPoints = useLabPoints(
    focusLayer === "hidrantes" || previewLayer === "hidrantes" ? "hidrantes" : null,
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

  // Demografía and hidrantes both only have meaningful data over Sevilla's casco urbano (hidrantes'
  // data literally doesn't exist elsewhere; demografía's per-vereda view is most legible zoomed into
  // the dense urban core). Focusing either one flies to that extent instead of leaving the user to
  // find it manually — same "fly once per activation" bookkeeping as `flownPointsLayers` below, keyed
  // by layer so re-focusing re-triggers it. This is purely a camera-position concern; whether the view
  // goes 3D is handled separately below, since only demografía defaults to 3D (see `AUTO_3D_LAYERS`).
  const CASCO_URBANO_BOUNDS_LAYERS: LayerKey[] = ["demografia", "hidrantes"]
  const flownCascoUrbanoLayers = useRef<Set<LayerKey>>(new Set())
  useEffect(() => {
    if (!focusLayer || !CASCO_URBANO_BOUNDS_LAYERS.includes(focusLayer)) {
      for (const layer of CASCO_URBANO_BOUNDS_LAYERS) flownCascoUrbanoLayers.current.delete(layer)
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

    const [[west, south], [east, north]] = SEVILLA_CASCO_URBANO_BOUNDS
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 60, duration: 2000 },
    )
  }, [focusLayer])

  // Demografía is the only layer that defaults into the 3D topographic view — every other category
  // (including hidrantes, which still flies to the casco urbano extent above) stays in whatever mode
  // the user last chose. Leaving demografía always eases the camera back to 2D, even if the user
  // manually toggled 3D while focused on it, since "the rest" of the app is meant to stay 2D by
  // default. While focused on demografía, a manual toggle is left alone (`flownAuto3DLayers` guards
  // against re-forcing 3D on every `is3D` change) so the voluntary override still works mid-session.
  const AUTO_3D_LAYERS: LayerKey[] = ["demografia"]
  const flownAuto3DLayers = useRef<Set<LayerKey>>(new Set())
  const wasAuto3DFocus = useRef(false)
  useEffect(() => {
    if (!focusLayer || !AUTO_3D_LAYERS.includes(focusLayer)) {
      flownAuto3DLayers.current.clear()
      if (wasAuto3DFocus.current && is3D) {
        const map = mapRef.current?.getMap()
        if (map) {
          setTransitioning(true)
          map.once("moveend", () => {
            setTransitioning(false)
            onToggle3D()
          })
          map.easeTo({ pitch: 0, bearing: 0, duration: 1500 })
        }
      }
      wasAuto3DFocus.current = false
      return
    }
    wasAuto3DFocus.current = true
    if (flownAuto3DLayers.current.has(focusLayer) || is3D) return
    const map = mapRef.current?.getMap()
    if (!map) return
    flownAuto3DLayers.current.add(focusLayer)
    setTransitioning(true)
    map.once("moveend", () => {
      setTransitioning(false)
      onToggle3D()
    })
    map.easeTo({ pitch: 60, bearing: 30, duration: 2000 })
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

  // Overlapping layers use hatch/dot patterns (per-feature, in the level's own color) instead of
  // transparency, so every layer's color stays legible where they stack. Images are generated lazily
  // via MapLibre's `styleimagemissing` event, which also survives basemap style swaps.
  const patternRegistry = useRef<globalThis.Map<string, { kind: OverlayPattern; color: string }>>(new globalThis.Map())
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.on("styleimagemissing", (e: { id: string }) => {
      const spec = patternRegistry.current.get(e.id)
      if (!spec || map.hasImage(e.id)) return
      const image = drawPattern(spec.kind, spec.color)
      if (image) map.addImage(e.id, image, { pixelRatio: 2 })
    })
  }, [])

  const sismoVeredasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredas || !resolved || !sismoActive || !activeSubLayerIds.has("sismo-veredas")) {
      return { type: "FeatureCollection", features: [] }
    }
    const noData = resolveCssColor(GRAY_FILL)
    return {
      type: "FeatureCollection",
      features: veredas.features.map((feature) => {
        const inMunicipio = !municipio || isMunicipioActive(feature.properties.municipio, [municipio])
        const score = (feature.properties as { seismicScoreAvg?: number | null }).seismicScoreAvg
        const color = inMunicipio && score != null ? resolved.exposure[seismicExposureLevel(score)] : noData
        return { ...feature, properties: { ...feature.properties, __fillColor: color } }
      }),
    }
  }, [veredas, resolved, sismoActive, activeSubLayerIds, municipio])

  const geojsonForLayer = useCallback(
    (layer: LayerKey, pattern: OverlayPattern | null = null): LabVeredasFeatureCollection | null => {
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
          let patternId: string | undefined
          if (pattern) {
            patternId = `lab-pat-${pattern}-${color.replace(/[^a-z0-9]/gi, "_")}`
            patternRegistry.current.set(patternId, { kind: pattern, color })
          }
          return {
            ...feature,
            properties: {
              ...feature.properties,
              __fillColor: color,
              __pattern: patternId,
              __inMunicipio: inMunicipio,
              __hasData: Boolean(style),
            },
          }
        }),
      }
    },
    [veredas, municipio],
  )

  // Faults are fetched for the visible envelope; damage columns collapse into one aggregate bar zoomed out.
  const syncViewport = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const b = map.getBounds()
    setViewportBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
    setDamageClustered(map.getZoom() < 12.5)
  }, [])

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
    const ids: string[] = []
    if (sismoActive) {
      ids.push("lab-seismic-events")
      if (activeSubLayerIds.has("faults")) ids.push("lab-faults-hit")
      if (activeSubLayerIds.has("damage")) ids.push("lab-damage-columns")
      if (activeSubLayerIds.has("sismo-veredas")) ids.push("lab-sismologia-fill")
    }
    if (incendiosFocus && (showModis || showViirs)) ids.push("lab-fires-points")
    ids.push(...[...fillLayers].reverse().map((layer) => `lab-${layer}-fill`))
    if (activeSubLayerIds.has("quebradas")) ids.push("lab-sub-quebradas-hit")
    if (focusLayer === "hidrantes") ids.push("lab-hidrantes-points", "lab-sensitive-sites-fill")
    if (activeLayers.includes("demografia")) ids.push(DEMOGRAFIA_LAYER_ID)
    return ids
  }, [fillLayers, activeSubLayerIds, focusLayer, activeLayers, sismoActive, incendiosFocus, showModis, showViirs])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]

      const layerId0 = feature?.layer?.id
      if (feature && layerId0 === "lab-seismic-events") {
        const p = feature.properties as unknown as SeismicEvent
        setFeaturePopup({
          lon: e.lngLat.lng,
          lat: e.lngLat.lat,
          content: (
            <div className="flex flex-col gap-0.5 text-sm">
              <strong className="text-foreground">M {Number(p.magnitude).toFixed(1)}</strong>
              <span className="text-muted-foreground">{formatDateTime(p.time)}</span>
              {p.place && <span className="text-muted-foreground">{p.place}</span>}
              {p.depthKm != null && <span className="text-muted-foreground">Profundidad: {Number(p.depthKm).toFixed(0)} km</span>}
            </div>
          ),
        })
        return
      }
      if (feature && layerId0 === "lab-faults-hit") {
        setFeaturePopup({
          lon: e.lngLat.lng,
          lat: e.lngLat.lat,
          content: (
            <div className="flex flex-col gap-0.5 text-sm">
              <strong className="text-foreground">{String(feature.properties?.nombre ?? "Falla geológica")}</strong>
              {feature.properties?.tipo && <span className="text-muted-foreground">{String(feature.properties.tipo)}</span>}
            </div>
          ),
        })
        return
      }
      if (feature && layerId0 === "lab-damage-columns") {
        setFeaturePopup({
          lon: e.lngLat.lng,
          lat: e.lngLat.lat,
          content: (
            <div className="flex flex-col gap-0.5 text-sm">
              <strong className="text-foreground">{String(feature.properties?.barrio)}</strong>
              <span className="text-muted-foreground">
                {String(feature.properties?.nivelLabel)}: {String(feature.properties?.count)} reportes
              </span>
            </div>
          ),
        })
        return
      }
      if (feature && layerId0 === "lab-fires-points") {
        const p = feature.properties as unknown as FireDetection & { nearest?: string | { name: string; distanceKm: number } }
        const nearest = typeof p.nearest === "string" ? JSON.parse(p.nearest) : p.nearest
        setFeaturePopup({
          lon: e.lngLat.lng,
          lat: e.lngLat.lat,
          content: (
            <div className="flex flex-col gap-0.5 text-sm">
              <strong className="text-foreground">{formatDateTime(p.acquiredAt)}</strong>
              {nearest && typeof nearest === "object" && (
                <span className="text-muted-foreground">
                  Cerca de {nearest.name} · {formatDistance(nearest.distanceKm)}
                </span>
              )}
              <span className="text-muted-foreground">Confianza: {CONFIDENCE_STYLES[p.confidence].label}</span>
              <span className="text-muted-foreground">FRP: {formatFrp(Number(p.frp))}</span>
              <span className="text-muted-foreground">Satélite: {p.satellite}</span>
            </div>
          ),
        })
        return
      }

      if (feature?.layer?.id === "lab-sub-quebradas-hit") {
        const nombre = (feature.properties?.nombre as string | undefined) ?? "Quebrada / río"
        setQuebradaPopup({ lon: e.lngLat.lng, lat: e.lngLat.lat, nombre })
        return
      }

      if (feature?.layer?.id === "lab-hidrantes-points") {
        hidrantesExperience.setPopupSite(null)
        hidrantesExperience.setPopupHidrante(feature as unknown as HidranteFeature)
        const [lon, lat] = (feature.geometry as GeoJSON.Point).coordinates
        const map = mapRef.current?.getMap()
        map?.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 17), duration: 900 })
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
        setFeaturePopup(null)

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
        onLoad={() => {
          handleMapLoad()
          syncViewport()
        }}
        onMoveEnd={syncViewport}
        cursor={cursor}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl position="bottom-right" compact />
        <NavigationControl position={controlsPosition} />
        <MapViewToggleControl is3D={is3D} onToggle={handleToggle3D} position={controlsPosition} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} position={controlsPosition} />

        {activeSubLayerIds.has("fires-fwi") && incendiosFocus && (
          <Source key={`fwi-${fwiDay}`} id="lab-sub-fwi-source" {...fwiSourceSpec}>
            <Layer id="lab-sub-fwi-raster" type="raster" paint={{ "raster-opacity": 0.65 }} />
          </Source>
        )}
        {activeSubLayerIds.has("fires-sentinel3") && incendiosFocus && (
          <Source id="lab-sub-s3-source" {...sentinel3SourceSpec}>
            <Layer id="lab-sub-s3-raster" type="raster" paint={{ "raster-opacity": 0.8 }} />
          </Source>
        )}
        {activeSubLayerIds.has("fires-landcover") && incendiosFocus && (
          <Source id="lab-sub-landcover-source" {...landCoverSourceSpec}>
            <Layer id="lab-sub-landcover-raster" type="raster" paint={{ "raster-opacity": 0.55 }} />
          </Source>
        )}

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

        {fillLayers.map((layer, index) => {
            // The bottom layer stays a solid fill; each layer stacked above it switches to a hatch or dot
            // pattern in its own level colors, so overlaps read as texture rather than blended transparency.
            const pattern = index > 0 ? OVERLAY_PATTERNS[(index - 1) % OVERLAY_PATTERNS.length] : null
            const data = geojsonForLayer(layer, pattern)
            if (!data) return null
            return (
              <Source key={layer} id={`lab-${layer}-source`} type="geojson" data={data}>
                <Layer
                  key={pattern ?? "solid"}
                  id={`lab-${layer}-fill`}
                  type="fill"
                  paint={
                    pattern
                      ? { "fill-pattern": ["get", "__pattern"], "fill-opacity": 0.95 }
                      : { "fill-color": ["get", "__fillColor"], "fill-opacity": fillLayers.length > 1 ? 0.9 : (layerOpacity[layer] ?? 0.55) }
                  }
                />
                <Layer
                  id={`lab-${layer}-line`}
                  type="line"
                  paint={{ "line-color": "rgba(0,0,0,0.55)", "line-width": 1 }}
                />
              </Source>
            )
          })}

        {sismoActive && activeSubLayerIds.has("sismo-veredas") && (
          <Source id="lab-sismologia-source" type="geojson" data={sismoVeredasGeoJson}>
            <Layer
              id="lab-sismologia-fill"
              type="fill"
              paint={{ "fill-color": ["get", "__fillColor"], "fill-opacity": layerOpacity.sismologia ?? 0.6 }}
            />
            <Layer id="lab-sismologia-line" type="line" paint={{ "line-color": "rgba(0,0,0,0.55)", "line-width": 1 }} />
          </Source>
        )}

        {sismoActive && (
          <Source id="lab-seismic-events-source" type="geojson" data={sismoEventsGeoJson}>
            <Layer
              id="lab-seismic-events"
              type="circle"
              paint={{
                "circle-radius": ["get", "__radius"],
                "circle-color": ["get", "fillColor"],
                "circle-opacity": ["get", "fillOpacity"],
                "circle-stroke-color": ["get", "strokeColor"],
                "circle-stroke-width": ["get", "strokeWidth"],
              }}
            />
          </Source>
        )}

        {sismoActive && activeSubLayerIds.has("faults") && (
          <Source id="lab-faults-source" type="geojson" data={faultsGeoJson}>
            <Layer
              id="lab-faults-line"
              type="line"
              paint={{ "line-color": resolved?.fault ?? "#888", "line-width": 2, "line-dasharray": [6, 4] }}
            />
            <Layer
              id="lab-faults-hit"
              type="line"
              paint={{ "line-color": resolved?.fault ?? "#888", "line-width": 18, "line-opacity": 0 }}
            />
          </Source>
        )}

        {sismoActive && activeSubLayerIds.has("damage") && (
          <Source id="lab-damage-source" type="geojson" data={damageColumnsGeoJson}>
            <Layer
              id="lab-damage-columns"
              type="fill-extrusion"
              paint={{
                "fill-extrusion-height": ["get", "__height"],
                "fill-extrusion-base": 0,
                "fill-extrusion-color": ["get", "__color"],
                "fill-extrusion-opacity": 0.88,
              }}
            />
          </Source>
        )}

        {incendiosFocus && (showModis || showViirs) && (
          <Source id="lab-fires-source" type="geojson" data={firesGeoJson}>
            <Layer
              id="lab-fires-points"
              type="circle"
              paint={{
                "circle-radius": ["get", "__radius"],
                "circle-color": ["get", "__color"],
                "circle-opacity": 0.85,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
              }}
            />
          </Source>
        )}

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
              <Layer
                id={`lab-preview-${previewLayer}-line`}
                type="line"
                paint={{ "line-color": "rgba(0,0,0,0.55)", "line-width": 1 }}
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

        {featurePopup && (
          <Popup
            longitude={featurePopup.lon}
            latitude={featurePopup.lat}
            onClose={() => setFeaturePopup(null)}
            closeOnClick={false}
            maxWidth="260px"
          >
            {featurePopup.content}
          </Popup>
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

      {(activePointsLayers.length > 0 || (focusLayer === "hidrantes" && (hidrantesPoints?.all.length ?? 0) > 0)) && (
        <div className="absolute left-1/2 top-20 z-10 flex -translate-x-1/2 gap-2">
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
          {focusLayer === "hidrantes" && hidrantesPoints && hidrantesPoints.all.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5 shadow-md"
              onClick={() => setPointsModalLayer("hidrantes")}
            >
              <List className="size-3.5" aria-hidden="true" />
              Ver todas · {LAYER_DEFINITIONS.hidrantes.shortLabel} ({hidrantesPoints.all.length})
            </Button>
          )}
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

type OverlayPattern = "stripes" | "dots"
const OVERLAY_PATTERNS: OverlayPattern[] = ["stripes", "dots"]

function drawPattern(kind: OverlayPattern, color: string): ImageData | null {
  const size = 16
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = color
  ctx.strokeStyle = color
  if (kind === "stripes") {
    ctx.lineWidth = 3
    for (const offset of [-size, 0, size]) {
      ctx.beginPath()
      ctx.moveTo(offset, size)
      ctx.lineTo(offset + size, 0)
      ctx.stroke()
    }
  } else {
    for (const [x, y] of [
      [4, 4],
      [12, 12],
    ]) {
      ctx.beginPath()
      ctx.arc(x, y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return ctx.getImageData(0, 0, size, size)
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
