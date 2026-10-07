"use client"

/**
 * Full Sevilla fire-hydrant experience (geolocation-or-click reference point,
 * nearest-by-distance + fastest-by-route highlighting, coverage circles,
 * "sitios sensibles" proximity) ported from `components/maps/hidrantes-live-map.tsx`
 * so the laboratorio's shared single map can offer the exact same
 * functionality instead of a bare point layer — this is considered core,
 * not optional, for the "hidrantes" layer in the lab.
 *
 * Deliberately map-ref-free: every derived value here is pure data (GeoJSON
 * FeatureCollections, ranked lists, route lookups). `lab-map.tsx` owns the
 * actual `<Map>`/`MapRef` and is responsible for turning `referencePoint`
 * changes into a camera move and for routing map clicks into
 * `setClickedPoint`/`setPopupHidrante`/`setPopupSite`.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import distance from "@turf/distance"
import buffer from "@turf/buffer"
import centroid from "@turf/centroid"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import { point } from "@turf/helpers"
import { SEVILLA_CASCO_URBANO_BOUNDS } from "@/lib/demografia/geo-detect"
import { SENSITIVE_PROXIMITY_M, type SensitiveSiteFeature } from "@/lib/osm/sensitive-sites"
import type { HidranteFeature, HidrantesGeoJson, HidranteRoute, ReferencePoint } from "@/lib/hidrantes/api-types"

const HIDRANTES_URL = "/data/hidrantes/hidrantes-sevilla.geojson"
const SITIOS_SENSIBLES_URL = "/data/hidrantes/sitios-sensibles.geojson"

const [[SEVILLA_WEST, SEVILLA_SOUTH], [SEVILLA_EAST, SEVILLA_NORTH]] = SEVILLA_CASCO_URBANO_BOUNDS
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

const sitiosSensiblesFetcher = async (url: string): Promise<GeoJSON.FeatureCollection> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de sitios sensibles")
  return res.json()
}

/**
 * Same routing instance/profile as production — see
 * `hidrantes-live-map.tsx`'s identical constant for why this exact host and
 * profile were chosen over the usual OSRM demo server.
 */
async function fetchOsrmRoute(lon1: number, lat1: number, lon2: number, lat2: number): Promise<HidranteRoute> {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`
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

export function formatHidranteDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

/** How many straight-line-nearest hydrants get an actual OSRM route fetched — see hidrantes-live-map.tsx. */
const ROUTE_CANDIDATE_COUNT = 8

export const COVERAGE_RADIUS_DEFAULT_M = 150
export const COVERAGE_RADIUS_TIGHT_M = 100

/** green (isolated/blind spot) → red (well covered) — see hidrantes-live-map.tsx for the rationale. */
export const COVERAGE_DENSITY_COLOR_EXPRESSION = [
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

export type HidranteGeoStatus = "idle" | "loading" | "granted" | "denied" | "unsupported" | "fuera"

function toRouteGeoJson(route: HidranteRoute | undefined | null): GeoJSON.Feature | null {
  return route ? { type: "Feature", properties: {}, geometry: route.geometry } : null
}

/**
 * @param enabled Only fetches/computes while the hidrantes layer is actually
 * focused — mirrors the lazy-fetch convention every other laboratorio layer
 * uses (see `useCompoundVeredas`, `useLabPoints`).
 */
export function useHidrantesExperience(enabled: boolean) {
  const { data: hidrantes, error: hidrantesError } = useSWR(enabled ? HIDRANTES_URL : null, hidrantesFetcher, {
    revalidateOnFocus: false,
  })
  const { data: sitiosSensibles } = useSWR(enabled ? SITIOS_SENSIBLES_URL : null, sitiosSensiblesFetcher, {
    revalidateOnFocus: false,
  })

  const [geoStatus, setGeoStatus] = useState<HidranteGeoStatus>("idle")
  const [userPosition, setUserPosition] = useState<{ lat: number; lon: number; accuracy: number } | null>(null)
  const [clickedPoint, setClickedPoint] = useState<{ lat: number; lon: number } | null>(null)
  const [popupHidrante, setPopupHidrante] = useState<HidranteFeature | null>(null)
  const [popupSite, setPopupSite] = useState<SensitiveSiteFeature | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [showCoverage, setShowCoverage] = useState(false)

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

  // Auto-requests once, the first time the layer is actually focused — same as production
  // mounting the dedicated page, but gated on `enabled` since this hook now lives for the
  // lifetime of the whole laboratorio workspace rather than a page dedicated to hidrantes.
  useEffect(() => {
    if (enabled && geoStatus === "idle") requestLocation()
  }, [enabled, geoStatus, requestLocation])

  const referencePoint: ReferencePoint | null = useMemo(() => {
    if (clickedPoint) return { ...clickedPoint, fromGeolocation: false }
    if (userPosition && geoStatus === "granted") return { ...userPosition, fromGeolocation: true }
    return null
  }, [clickedPoint, userPosition, geoStatus])

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

  const routeTargets = useMemo(() => {
    if (selectedIndex != null && hidrantes?.features[selectedIndex]) {
      return [{ feature: hidrantes.features[selectedIndex], index: selectedIndex }]
    }
    return rankedByDistance.slice(0, ROUTE_CANDIDATE_COUNT)
  }, [selectedIndex, hidrantes, rankedByDistance])

  const routesKey = useMemo(() => {
    if (!referencePoint || routeTargets.length === 0) return null
    return [
      "lab-hidrantes-routes",
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
  const routeByRouteFeature = nearestByRouteIndex != null ? hidrantes?.features[nearestByRouteIndex] ?? null : null
  const sameNearest = nearestByDistance != null && nearestByRouteIndex === nearestByDistance.index

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

  const sensitiveSiteTests = useMemo(() => {
    if (!sitiosSensibles) return []
    return sitiosSensibles.features.map((f) => ({
      feature: f,
      center: f.geometry.type === "Point" ? f : centroid(f as GeoJSON.Feature<GeoJSON.Polygon>),
    }))
  }, [sitiosSensibles])

  const isNearSensitiveSite = useCallback(
    (lon: number, lat: number) => {
      const hydrant = point([lon, lat])
      return sensitiveSiteTests.some(({ feature, center }) => {
        if (
          (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") &&
          booleanPointInPolygon(hydrant, feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon)
        ) {
          return true
        }
        return distance(hydrant, center as GeoJSON.Feature<GeoJSON.Point>, { units: "meters" }) < SENSITIVE_PROXIMITY_M
      })
    },
    [sensitiveSiteTests],
  )

  const coverageGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!showCoverage || !hidrantes || hidrantes.features.length === 0) return null
    const points = hidrantes.features.map((f) => point(f.geometry.coordinates))
    const radii = hidrantes.features.map((f) => {
      const [lon, lat] = f.geometry.coordinates
      return isNearSensitiveSite(lon, lat) ? COVERAGE_RADIUS_TIGHT_M : COVERAGE_RADIUS_DEFAULT_M
    })
    const overlapCounts = points.map((p, i) => {
      let count = 0
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue
        const overlapThresholdKm = (radii[i] + radii[j]) / 1000
        if (distance(p, points[j], { units: "kilometers" }) < overlapThresholdKm) count++
      }
      return count
    })
    return {
      type: "FeatureCollection",
      features: hidrantes.features
        .map((f, i) => {
          const circle = buffer(points[i], radii[i], { units: "meters", steps: 32 })
          if (!circle) return null
          circle.properties = { ...circle.properties, __overlapCount: overlapCounts[i], __radius: radii[i] }
          return circle
        })
        .filter((f): f is NonNullable<typeof f> => f != null) as GeoJSON.Feature[],
    }
  }, [showCoverage, hidrantes, isNearSensitiveSite])

  const sensitiveSitePolygons = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!sitiosSensibles) return null
    const features = sitiosSensibles.features.filter(
      (f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon",
    )
    return { type: "FeatureCollection", features }
  }, [sitiosSensibles])

  const selectedRoute = selectedIndex != null ? routesByIndex?.get(selectedIndex) : null
  const distanceRoute = selectedIndex == null && nearestByDistance ? routesByIndex?.get(nearestByDistance.index) : null
  const routeRoute =
    selectedIndex == null && nearestByRouteIndex != null && !sameNearest
      ? routesByIndex?.get(nearestByRouteIndex)
      : null

  return {
    hidrantesError,
    geoStatus,
    userPosition,
    clickedPoint,
    referencePoint,
    requestLocation,
    setClickedPoint,
    popupHidrante,
    setPopupHidrante,
    popupSite,
    setPopupSite,
    selectedIndex,
    setSelectedIndex,
    showCoverage,
    setShowCoverage,
    nearestByDistance,
    nearestByRouteIndex,
    selectedFeature,
    routeByRouteFeature,
    sameNearest,
    hidrantesGeoJson,
    coverageGeoJson,
    sensitiveSitePolygons,
    selectedRoute,
    distanceRoute,
    routeRoute,
    selectedRouteGeoJson: toRouteGeoJson(selectedRoute),
    distanceRouteGeoJson: toRouteGeoJson(distanceRoute),
    routeRouteGeoJson: toRouteGeoJson(routeRoute),
  }
}

export type HidrantesExperience = ReturnType<typeof useHidrantesExperience>
