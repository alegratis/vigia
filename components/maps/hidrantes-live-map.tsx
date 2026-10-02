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
 * Sevilla-only fire-hydrant map: geolocates the user (falling back to a
 * map click anywhere, which always overrides geolocation once used),
 * highlights the closest hydrant from that reference point, and draws a
 * street-following route line to it via OSRM — straight-line distance
 * alone if OSRM is unreachable. See hidrantes-panel-content.tsx for the
 * surrounding explanatory copy.
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
  const [cursor, setCursor] = useState("")
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

  const nearest = useMemo(() => {
    if (!referencePoint || !hidrantes || hidrantes.features.length === 0) return null
    let best: HidranteFeature | null = null
    let bestIndex = -1
    let bestKm = Infinity
    for (let index = 0; index < hidrantes.features.length; index++) {
      const feature = hidrantes.features[index]
      const [lon, lat] = feature.geometry.coordinates
      const km = distance(point([referencePoint.lon, referencePoint.lat]), point([lon, lat]), {
        units: "kilometers",
      })
      if (km < bestKm) {
        bestKm = km
        best = feature
        bestIndex = index
      }
    }
    return best ? { feature: best, index: bestIndex, distanceKm: bestKm } : null
  }, [referencePoint, hidrantes])

  const routeKey = useMemo(() => {
    if (!referencePoint || !nearest) return null
    const [hLon, hLat] = nearest.feature.geometry.coordinates
    return ["hidrantes-route", referencePoint.lon, referencePoint.lat, hLon, hLat] as const
  }, [referencePoint, nearest])

  const { data: route } = useSWR(
    routeKey,
    async (_key: string, lon1: number, lat1: number, lon2: number, lat2: number) => {
      try {
        return await fetchOsrmRoute(lon1, lat1, lon2, lat2)
      } catch {
        return straightLineFallback(lon1, lat1, lon2, lat2)
      }
    },
    { revalidateOnFocus: false },
  )

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap()
      const tolerance = 8
      const bbox: [[number, number], [number, number]] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance],
      ]
      const clusterHit = map && map.getLayer("hidrantes-clusters") ? map.queryRenderedFeatures(bbox, { layers: ["hidrantes-clusters"] })[0] : undefined
      if (clusterHit) {
        const clusterId = clusterHit.properties?.cluster_id
        const source = map!.getSource("hidrantes-source") as import("maplibre-gl").GeoJSONSource
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map!.easeTo({ center: (clusterHit.geometry as GeoJSON.Point).coordinates as [number, number], zoom, duration: 500 })
        })
        return
      }
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
    const nearestIndex = nearest?.index ?? -1
    return {
      type: "FeatureCollection",
      features: hidrantes.features.map((f, index) => ({
        type: "Feature",
        properties: { ...f.properties, __nearest: index === nearestIndex },
        geometry: f.geometry,
      })),
    }
  }, [hidrantes, nearest])

  const routeGeoJson = useMemo<GeoJSON.Feature | null>(() => {
    if (!route) return null
    return { type: "Feature", properties: {}, geometry: route.geometry }
  }, [route])

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

        {routeGeoJson && (
          <Source id="route-source" type="geojson" data={routeGeoJson}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#2563eb",
                "line-width": 4,
                "line-opacity": 0.85,
                "line-dasharray": route && !route.followsStreets ? [1, 1.5] : [1, 0],
              }}
            />
          </Source>
        )}

        <Source
          id="hidrantes-source"
          type="geojson"
          data={hidrantesGeoJson}
          cluster={true}
          clusterMaxZoom={16}
          clusterRadius={50}
        >
          <Layer
            id="hidrantes-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
              "circle-color": ["step", ["get", "point_count"], "#f97316", 10, "#ea580c", 50, "#c2410c"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id="hidrantes-cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            }}
            paint={{ "text-color": "#ffffff" }}
          />
          <Layer
            id="hidrantes-points"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-radius": ["case", ["get", "__nearest"], 9, 6],
              "circle-color": ["case", ["get", "__nearest"], "#f59e0b", "#dc2626"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": ["case", ["get", "__nearest"], 3, 1.5],
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
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>{popupHidrante.properties.nombre ?? "Hidrante"}</strong>
              {popupHidrante.properties.direccion && <span>{popupHidrante.properties.direccion}</span>}
              {popupHidrante.properties.tipo && <span>{popupHidrante.properties.tipo}</span>}
              {popupHidrante.properties.muestra && (
                <span style={{ color: "#b45309" }}>Dato de muestra — no corresponde a un hidrante real</span>
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

        <RailSection title="Hidrante más cercano">
          {!referencePoint && <p className="text-muted-foreground">Elige tu ubicación o haz clic en el mapa.</p>}
          {referencePoint && !nearest && <p className="text-muted-foreground">Cargando capa de hidrantes…</p>}
          {referencePoint && nearest && (
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">{nearest.feature.properties.nombre ?? "Hidrante"}</p>
              <p className="text-muted-foreground">
                {route ? formatDistance(route.distanceM) : `${nearest.distanceKm.toFixed(2)} km`}
                {route && route.followsStreets && route.durationS > 0 && ` · ${formatDuration(route.durationS)} en vehículo`}
                {route && !route.followsStreets && " · línea recta (ruta por calles no disponible)"}
              </p>
            </div>
          )}
        </RailSection>

        <RailSection title="Leyenda">
          <ul className="flex flex-col gap-1.5">
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full border border-white/60 bg-[#dc2626]" aria-hidden="true" />
              Hidrantes
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full border border-white/60 bg-[#f59e0b]" aria-hidden="true" />
              Hidrante más cercano
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
