"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Map, {
  Source,
  Layer,
  Popup,
  Marker,
  NavigationControl,
  AttributionControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre"
import { setWorkerUrl } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// See deslizamientos-live-map.tsx for why this self-hosted worker override is needed under Turbopack.
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}
import useSWR from "swr"
import distance from "@turf/distance"
import buffer from "@turf/buffer"
import { point } from "@turf/helpers"
import { LocateFixed, MapPin, Siren, TriangleAlert } from "lucide-react"
import { MapControlRail, RailSection } from "@/components/maps/map-control-rail"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { maplibreMapStyle } from "@/lib/maps/maplibre-basemap-style"
import { useThemeSyncedBasemap } from "@/lib/maps/use-theme-synced-basemap"
import { SEVILLA_CASCO_URBANO_BOUNDS } from "@/lib/demografia/geo-detect"
import type { HidranteFeature, HidrantesGeoJson, HidranteRoute, ReferencePoint } from "@/lib/hidrantes/api-types"

const HIDRANTES_URL = "/data/hidrantes/hidrantes-sevilla.geojson"

const [[SEVILLA_WEST, SEVILLA_SOUTH], [SEVILLA_EAST, SEVILLA_NORTH]] = SEVILLA_CASCO_URBANO_BOUNDS
const SEVILLA_CENTER: [number, number] = [(SEVILLA_WEST + SEVILLA_EAST) / 2, (SEVILLA_SOUTH + SEVILLA_NORTH) / 2]
/** Generous padding (~8km) around the casco urbano box: geolocation outside this is treated as "not in Sevilla". */
const SEVILLA_TOLERANCE_DEG = 0.08

function isNearSevilla(lat: number, lon: number): boolean {
  return (
    lon >= SEVILLA_WEST - SEVILLA_TOLERANCE_DEG &&
    lon <= SEVILLA_EAST + SEVILLA_TOLERANCE_DEG &&
    lat >= SEVILLA_SOUTH - SEVILLA_TOLERANCE_DEG &&
    lat <= SEVILLA_NORTH + SEVILLA_TOLERANCE_DEG
  )
}

const hidrantesFetcher = async (url: string): Promise<HidrantesGeoJson> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de hidrantes")
  return res.json()
}

/**
 * Routes through OSRM's free public demo instance (car profile only — the
 * only one that server actually hosts), used here purely to draw a
 * street-following line and give a rough distance/time; no turn-by-turn
 * steps are requested or shown.
 */
async function fetchOsrmRoute(lon1: number, lat1: number, lon2: number, lat2: number): Promise<HidranteRoute> {
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error("OSRM no disponible")
  const json = await res.json()
  const route = json.routes?.[0]
  if (!route) throw new Error("Sin ruta disponible")
  return { geometry: route.geometry, distanceM: route.distance, durationS: route.duration, followsStreets: true }
}

function straightLineFallback(lon1: number, lat1: number, lon2: number, lat2: number): HidranteRoute {
  const distanceKm = distance(point([lon1, lat1]), point([lon2, lat2]), { units: "kilometers" })
  return {
    geometry: { type: "LineString", coordinates: [[lon1, lat1], [lon2, lat2]] },
    distanceM: distanceKm * 1000,
    durationS: 0,
    followsStreets: false,
  }
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

function formatDuration(s: number): string {
  const minutes = Math.round(s / 60)
  return minutes < 1 ? "menos de 1 min" : `${minutes} min`
}

/**
 * How many straight-line-nearest hydrants get an actual OSRM route fetched.
 * Checking driving distance for every hydrant on every reference-point
 * change isn't practical against OSRM's free public instance, so this
 * narrows to a short list first — the physically closest hydrant and the
 * fastest-to-drive-to one are both assumed to be within this set.
 */
const ROUTE_CANDIDATE_COUNT = 8

/**
 * Sevilla-only fire-hydrant map: geolocates the user (falling back to a
 * map click anywhere, which always overrides geolocation once used) and
 * highlights two distinct hydrants from that reference point — the one
 * that's physically closest, and (when it differs) the one that's
 * actually fastest to drive to via OSRM, since Sevilla's street layout can
 * make the nearest-by-air hydrant a detour. Either highlighted hydrant, or
 * any other hydrant on the map, can also be picked explicitly for
 * directions — an explicit pick always overrides the automatic pair. See
 * hidrantes-panel-content.tsx for the surrounding explanatory copy.
 */
export default function HidrantesLiveMap({ className }: { className?: string }) {
  const mapRef = useRef<MapRef>(null)
  const [basemap, setBasemap] = useThemeSyncedBasemap()
  const [is3D, setIs3D] = useState(false)
  const mapStyle = useMemo(() => maplibreMapStyle(basemap, is3D), [basemap, is3D])

  const { data: hidrantes, error: hidrantesError } = useSWR(HIDRANTES_URL, hidrantesFetcher, {
    revalidateOnFocus: false,
  })

  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "granted" | "denied" | "unsupported" | "fuera">(
    "idle",
  )
  const [userPosition, setUserPosition] = useState<{ lat: number; lon: number; accuracy: number } | null>(null)
  const [clickedPoint, setClickedPoint] = useState<{ lat: number; lon: number } | null>(null)
  const [popupHidrante, setPopupHidrante] = useState<HidranteFeature | null>(null)
  /** Explicit "ir a este hidrante" pick from a popup — overrides both automatic highlights below. */
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [cursor, setCursor] = useState("")
  const [showCoverage, setShowCoverage] = useState(false)
  const hasFlownToUser = useRef(false)

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("unsupported")
      return
    }
    setGeoStatus("loading")
    setClickedPoint(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setUserPosition({ lat: latitude, lon: longitude, accuracy })
        setGeoStatus(isNearSevilla(latitude, longitude) ? "granted" : "fuera")
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  useEffect(() => {
    if (hasFlownToUser.current || !userPosition || geoStatus !== "granted") return
    hasFlownToUser.current = true
    mapRef.current?.getMap()?.easeTo({ center: [userPosition.lon, userPosition.lat], zoom: 16, duration: 900 })
  }, [userPosition, geoStatus])

  const referencePoint: ReferencePoint | null = useMemo(() => {
    if (clickedPoint) return { ...clickedPoint, fromGeolocation: false }
    if (userPosition && geoStatus === "granted") return { ...userPosition, fromGeolocation: true }
    return null
  }, [clickedPoint, userPosition, geoStatus])

  /** All hydrants ranked by straight-line distance from the reference point — cheap, no network calls. */
  const rankedByDistance = useMemo(() => {
    if (!referencePoint || !hidrantes || hidrantes.features.length === 0) return []
    return hidrantes.features
      .map((feature, index) => {
        const [lon, lat] = feature.geometry.coordinates
        const distanceKm = distance(point([referencePoint.lon, referencePoint.lat]), point([lon, lat]), {
          units: "kilometers",
        })
        return { feature, index, distanceKm }
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [referencePoint, hidrantes])

  const nearestByDistance = rankedByDistance[0] ?? null

  // Only the short candidate list gets an OSRM route fetched — either the user's explicit pick
  // (one request) or the N physically-nearest hydrants, so the "fastest to actually drive to"
  // highlight below can differ from the "nearest in a straight line" one.
  const routeTargets = useMemo(() => {
    if (selectedIndex != null && hidrantes?.features[selectedIndex]) {
      return [{ feature: hidrantes.features[selectedIndex], index: selectedIndex }]
    }
    return rankedByDistance.slice(0, ROUTE_CANDIDATE_COUNT)
  }, [selectedIndex, hidrantes, rankedByDistance])

  const routesKey = useMemo(() => {
    if (!referencePoint || routeTargets.length === 0) return null
    return [
      "hidrantes-routes",
      referencePoint.lon,
      referencePoint.lat,
      routeTargets.map((t) => t.index).join(","),
    ] as const
  }, [referencePoint, routeTargets])

  const { data: routesByIndex } = useSWR(
    routesKey,
    async ([, lon1, lat1]: NonNullable<typeof routesKey>) => {
      const entries = await Promise.all(
        routeTargets.map(async ({ feature, index }) => {
          const [lon2, lat2] = feature.geometry.coordinates
          try {
            return [index, await fetchOsrmRoute(lon1, lat1, lon2, lat2)] as const
          } catch {
            return [index, straightLineFallback(lon1, lat1, lon2, lat2)] as const
          }
        }),
      )
      return new globalThis.Map(entries)
    },
    { revalidateOnFocus: false },
  )

  // The fastest-to-drive hydrant among the candidates — only counts actual OSRM results, since
  // comparing straight-line fallbacks against each other wouldn't reflect driving distance.
  const nearestByRouteIndex = useMemo(() => {
    if (selectedIndex != null || !routesByIndex) return null
    let bestIndex: number | null = null
    let bestDistanceM = Infinity
    for (const { index } of rankedByDistance.slice(0, ROUTE_CANDIDATE_COUNT)) {
      const route = routesByIndex.get(index)
      if (route?.followsStreets && route.distanceM < bestDistanceM) {
        bestDistanceM = route.distanceM
        bestIndex = index
      }
    }
    return bestIndex
  }, [selectedIndex, routesByIndex, rankedByDistance])

  const selectedFeature = selectedIndex != null ? hidrantes?.features[selectedIndex] ?? null : null
  const routeByRouteFeature =
    nearestByRouteIndex != null ? hidrantes?.features[nearestByRouteIndex] ?? null : null
  const sameNearest = nearestByDistance != null && nearestByRouteIndex === nearestByDistance.index

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap()
      const tolerance = 8
      const bbox: [[number, number], [number, number]] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance],
      ]
      const hit = map && map.getLayer("hidrantes-points") ? map.queryRenderedFeatures(bbox, { layers: ["hidrantes-points"] })[0] : undefined
      if (hit) {
        setPopupHidrante(hit as unknown as HidranteFeature)
        return
      }
      setPopupHidrante(null)
      setClickedPoint({ lat: e.lngLat.lat, lon: e.lngLat.lng })
    },
    [],
  )

  const hidrantesGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!hidrantes) return { type: "FeatureCollection", features: [] }
    const distanceIndex = selectedIndex == null ? nearestByDistance?.index ?? -1 : -1
    const routeIndex = selectedIndex == null ? nearestByRouteIndex ?? -1 : -1
    return {
      type: "FeatureCollection",
      features: hidrantes.features.map((f, index) => {
        let highlight: "none" | "distance" | "route" | "both" | "selected" = "none"
        if (selectedIndex === index) highlight = "selected"
        else if (index === distanceIndex && index === routeIndex) highlight = "both"
        else if (index === distanceIndex) highlight = "distance"
        else if (index === routeIndex) highlight = "route"
        return {
          type: "Feature",
          properties: { ...f.properties, __index: index, __highlight: highlight },
          geometry: f.geometry,
        }
      }),
    }
  }, [hidrantes, selectedIndex, nearestByDistance, nearestByRouteIndex])

/** Hose reach used for each coverage circle — two circles overlap once their hydrants are closer than twice this. */
 const COVERAGE_RADIUS_M = 150

/**
 * Maps __overlapCount (how many neighboring hydrants' circles intersect this
 * one) to a green → yellow → red ramp: isolated hydrants with no overlap —
 * the actual blind spots this layer exists to reveal — read as green/safe,
 * while heavily overlapping clusters read as red/dense. This intentionally
 * inverts the usual "red = danger" convention, since here red just means
 * "well covered", not "hazardous".
 */
const COVERAGE_DENSITY_COLOR_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["get", "__overlapCount"],
  0,
  "#dc2626",
  1,
  "#f97316",
  2,
  "#eab308",
  3,
  "#84cc16",
  5,
  "#16a34a",
] as unknown as string

  /**
   * 120 m coverage circles around every hydrant — the typical reach of a fire
   * hose — so gaps in coverage become visually obvious. Off by default and
   * toggled via the rail control below; only computed once the layer is shown.
   *
   * Each circle is tagged with __overlapCount — how many other hydrants sit
   * close enough for their coverage circles to intersect this one — so the
   * fill can be colored by density (green = isolated/blind spot, red = many
   * overlapping hydrants) instead of a flat, alarm-like red.
   */
  const coverageGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!showCoverage || !hidrantes || hidrantes.features.length === 0) return null
    const points = hidrantes.features.map((f) => point(f.geometry.coordinates))
    const overlapThresholdKm = (COVERAGE_RADIUS_M * 2) / 1000
    const overlapCounts = points.map((p, i) => {
      let count = 0
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue
        if (distance(p, points[j], { units: "kilometers" }) < overlapThresholdKm) count++
      }
      return count
    })
    return {
      type: "FeatureCollection",
      features: hidrantes.features
        .map((f, i) => {
          const circle = buffer(points[i], COVERAGE_RADIUS_M, { units: "meters", steps: 32 })
          if (!circle) return null
          circle.properties = { ...circle.properties, __overlapCount: overlapCounts[i] }
          return circle
        })
        .filter((f): f is NonNullable<typeof f> => f != null) as GeoJSON.Feature[],
    }
  }, [showCoverage, hidrantes])

  const toRouteGeoJson = (route: HidranteRoute | undefined | null): GeoJSON.Feature | null =>
    route ? { type: "Feature", properties: {}, geometry: route.geometry } : null

  const selectedRoute = selectedIndex != null ? routesByIndex?.get(selectedIndex) : null
  const distanceRoute =
    selectedIndex == null && nearestByDistance ? routesByIndex?.get(nearestByDistance.index) : null
  const routeRoute =
    selectedIndex == null && nearestByRouteIndex != null && !sameNearest
      ? routesByIndex?.get(nearestByRouteIndex)
      : null

  const selectedRouteGeoJson = toRouteGeoJson(selectedRoute)
  const distanceRouteGeoJson = toRouteGeoJson(distanceRoute)
  const routeRouteGeoJson = toRouteGeoJson(routeRoute)

  return (
    <div className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: SEVILLA_CENTER[0], latitude: SEVILLA_CENTER[1], zoom: 15 }}
        minZoom={12}
        maxZoom={19}
        mapStyle={mapStyle}
        attributionControl={false}
        cursor={cursor}
        interactiveLayerIds={["hidrantes-points"]}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-left" />
        <MapViewToggleControl is3D={is3D} onToggle={() => setIs3D((v) => !v)} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} />
        <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO / OSRM" compact />

        {distanceRouteGeoJson && (
          <Source id="route-distance-source" type="geojson" data={distanceRouteGeoJson}>
            <Layer
              id="route-distance-line"
              type="line"
              paint={{
                "line-color": "#f59e0b",
                "line-width": 4,
                "line-opacity": 0.85,
                "line-dasharray": distanceRoute && !distanceRoute.followsStreets ? [1, 1.5] : [1, 0],
              }}
            />
          </Source>
        )}

        {routeRouteGeoJson && (
          <Source id="route-fastest-source" type="geojson" data={routeRouteGeoJson}>
            <Layer
              id="route-fastest-line"
              type="line"
              paint={{
                "line-color": "#16a34a",
                "line-width": 4,
                "line-opacity": 0.85,
                "line-dasharray": routeRoute && !routeRoute.followsStreets ? [1, 1.5] : [1, 0],
              }}
            />
          </Source>
        )}

        {selectedRouteGeoJson && (
          <Source id="route-selected-source" type="geojson" data={selectedRouteGeoJson}>
            <Layer
              id="route-selected-line"
              type="line"
              paint={{
                "line-color": "#7c3aed",
                "line-width": 4,
                "line-opacity": 0.85,
                "line-dasharray": selectedRoute && !selectedRoute.followsStreets ? [1, 1.5] : [1, 0],
              }}
            />
          </Source>
        )}

        {coverageGeoJson && (
          <Source id="hidrantes-coverage-source" type="geojson" data={coverageGeoJson}>
            <Layer
              id="hidrantes-coverage-fill"
              type="fill"
              paint={{ "fill-color": COVERAGE_DENSITY_COLOR_EXPRESSION, "fill-opacity": 0.22 }}
            />
            <Layer
              id="hidrantes-coverage-outline"
              type="line"
              paint={{ "line-color": COVERAGE_DENSITY_COLOR_EXPRESSION, "line-width": 1, "line-opacity": 0.6 }}
            />
          </Source>
        )}

        <Source id="hidrantes-source" type="geojson" data={hidrantesGeoJson}>
          <Layer
            id="hidrantes-points"
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

        {referencePoint && (
          <Marker longitude={referencePoint.lon} latitude={referencePoint.lat} anchor="bottom">
            <div className="flex flex-col items-center">
              <MapPin className="size-7 fill-blue-500 text-white drop-shadow" aria-hidden="true" />
              <span className="sr-only">
                {referencePoint.fromGeolocation ? "Tu ubicación" : "Punto seleccionado"}
              </span>
            </div>
          </Marker>
        )}

        {popupHidrante && (
          <Popup
            longitude={popupHidrante.geometry.coordinates[0]}
            latitude={popupHidrante.geometry.coordinates[1]}
            onClose={() => setPopupHidrante(null)}
            closeButton
            closeOnClick={false}
          >
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
              <strong>{popupHidrante.properties.nombre ?? "Hidrante"}</strong>
              {popupHidrante.properties.direccion && <span>{popupHidrante.properties.direccion}</span>}
              {popupHidrante.properties.tipo && <span>{popupHidrante.properties.tipo}</span>}
              {popupHidrante.properties.muestra && (
                <span style={{ color: "#b45309" }}>Dato de muestra — no corresponde a un hidrante real</span>
              )}
              {referencePoint && typeof popupHidrante.properties.__index === "number" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIndex(popupHidrante.properties.__index as number)
                    setPopupHidrante(null)
                  }}
                  style={{
                    marginTop: 2,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    borderRadius: 6,
                    border: "1px solid #7c3aed",
                    background: "#7c3aed",
                    color: "#fff",
                    padding: "4px 8px",
                    fontWeight: 500,
                    fontSize: 12,
                  }}
                >
                  Dirígeme a este hidrante
                </button>
              )}
            </div>
          </Popup>
        )}
      </Map>

      <MapControlRail>
        <RailSection title="Tu ubicación" first>
          <div className="flex flex-col gap-2">
            {geoStatus === "loading" && <p className="text-muted-foreground">Buscando tu ubicación…</p>}
            {geoStatus === "granted" && userPosition && !clickedPoint && (
              <p className="text-muted-foreground">
                Ubicación activa (precisión ≈ {Math.round(userPosition.accuracy)} m).
              </p>
            )}
            {geoStatus === "fuera" && !clickedPoint && (
              <p className="flex items-start gap-1.5 text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Estás fuera de Sevilla. Haz clic en el mapa para ubicar el hidrante más cercano a un punto.
              </p>
            )}
            {(geoStatus === "denied" || geoStatus === "unsupported") && !clickedPoint && (
              <p className="flex items-start gap-1.5 text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                No se pudo obtener tu ubicación. Haz clic en el mapa para elegir un punto.
              </p>
            )}
            {clickedPoint && <p className="text-muted-foreground">Usando el punto que elegiste en el mapa.</p>}
            <button
              type="button"
              onClick={requestLocation}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LocateFixed className="size-3.5" aria-hidden="true" />
              Usar mi ubicación
            </button>
          </div>
        </RailSection>

        {selectedIndex != null && selectedFeature ? (
          <RailSection title="Hidrante elegido">
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">{selectedFeature.properties.nombre ?? "Hidrante"}</p>
              <p className="text-muted-foreground">
                {selectedRoute ? formatDistance(selectedRoute.distanceM) : "Calculando ruta…"}
                {selectedRoute?.followsStreets &&
                  selectedRoute.durationS > 0 &&
                  ` · ${formatDuration(selectedRoute.durationS)} en vehículo`}
                {selectedRoute && !selectedRoute.followsStreets && " · línea recta (ruta por calles no disponible)"}
              </p>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="mt-1 inline-flex w-fit items-center justify-center rounded-md border border-border bg-background px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-muted"
              >
                Volver a los más cercanos
              </button>
            </div>
          </RailSection>
        ) : (
          <RailSection title="Hidrantes más cercanos">
            {!referencePoint && <p className="text-muted-foreground">Elige tu ubicación o haz clic en el mapa.</p>}
            {referencePoint && !nearestByDistance && (
              <p className="text-muted-foreground">Cargando capa de hidrantes…</p>
            )}
            {referencePoint && nearestByDistance && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="size-2.5 shrink-0 rounded-full bg-[#f59e0b]" aria-hidden="true" />
                    {nearestByDistance.feature.properties.nombre ?? "Hidrante"} — en línea recta
                  </p>
                  <p className="text-muted-foreground">
                    {distanceRoute ? formatDistance(distanceRoute.distanceM) : `${nearestByDistance.distanceKm.toFixed(2)} km`}
                    {distanceRoute?.followsStreets &&
                      distanceRoute.durationS > 0 &&
                      ` · ${formatDuration(distanceRoute.durationS)} en vehículo`}
                  </p>
                </div>
                {sameNearest ? (
                  <p className="text-muted-foreground">También es el más rápido en vehículo.</p>
                ) : routeByRouteFeature ? (
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      <span className="size-2.5 shrink-0 rounded-full bg-[#16a34a]" aria-hidden="true" />
                      {routeByRouteFeature.properties.nombre ?? "Hidrante"} — más rápido en coche
                    </p>
                    <p className="text-muted-foreground">
                      {routeRoute ? formatDistance(routeRoute.distanceM) : null}
                      {routeRoute?.followsStreets &&
                        routeRoute.durationS > 0 &&
                        ` · ${formatDuration(routeRoute.durationS)} en vehículo`}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Calculando la ruta más rápida en coche…</p>
                )}
                <p className="text-muted-foreground">
                  También puedes hacer clic en cualquier hidrante del mapa para ir directamente a él.
                </p>
              </div>
            )}
          </RailSection>
        )}

        <RailSection title="Área de Cobertura">
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="text-foreground">Radio de manguera (150 m)</span>
              <button
                type="button"
                role="switch"
                aria-checked={showCoverage}
                onClick={() => setShowCoverage((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
                  showCoverage ? "border-primary bg-primary" : "border-border bg-muted"
                }`}
              >
                <span
                  className={`inline-block size-3.5 transform rounded-full bg-background shadow transition-transform ${
                    showCoverage ? "translate-x-[18px]" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
            <p className="text-muted-foreground">
                        Muestra el área que cubre cada hidrante con una manguera de 150 m, útil para detectar puntos ciegos.
            </p>
          </div>
        </RailSection>

        <RailSection title="Leyenda">
          <ul className="flex flex-col gap-1.5">
            {showCoverage && (
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="size-2.5 shrink-0 rounded-full border border-[#dc2626]/60 bg-[#dc2626]/20" aria-hidden="true" />
                  Área de Cobertura (150 m)
              </li>
            )}
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full border border-white/60 bg-[#dc2626]" aria-hidden="true" />
              Hidrantes
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full border border-white/60 bg-[#f59e0b]" aria-hidden="true" />
              Más cercano en línea recta
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full border border-white/60 bg-[#16a34a]" aria-hidden="true" />
              Más rápido en coche
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full border border-white/60 bg-[#7c3aed]" aria-hidden="true" />
              Hidrante elegido manualmente
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 fill-blue-500 text-white" aria-hidden="true" />
              Tu ubicación / punto elegido
            </li>
          </ul>
        </RailSection>
      </MapControlRail>

      {hidrantesError && (
        <div className="absolute inset-x-3 bottom-3 z-[400] flex items-center gap-2 rounded-md border border-destructive/30 bg-card/90 px-3 py-2 text-xs text-destructive backdrop-blur-md">
          <Siren className="size-4 shrink-0" aria-hidden="true" />
          No se pudo cargar la capa de hidrantes.
        </div>
      )}
    </div>
  )
}
