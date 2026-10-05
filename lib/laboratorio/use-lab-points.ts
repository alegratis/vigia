"use client"

/**
 * Fetches and normalizes the two "points" layers (sismología epicenters,
 * hidrantes) into one shared `LabPointFeature` shape the map and the
 * points-list modal both consume — unlike the vereda-choropleth layers,
 * these aren't per-vereda scores, they're raw point events/assets, so they
 * get their own fetch + normalize step instead of flowing through
 * `mergeXIntoVeredas`. Each source is only fetched while its layer is
 * active or previewed, same lazy-fetch pattern as `useCompoundVeredas`.
 */

import useSWR from "swr"
import { magnitudeColorToken, magnitudeRadius } from "@/lib/sismologia/levels"
import type { SismologiaEventosResponse } from "@/lib/sismologia/api-types"
import type { LayerKey } from "./layers"

export interface LabPointFeature {
  id: string
  lon: number
  lat: number
  label: string
  sublabel: string
  colorToken: string
  radius: number
  /** ISO timestamp, when the point has one — drives the modal's most-recent-first ordering. */
  sortKey: number
}

/** Points layers shown nearest-to-map-center / most-recent first, trimmed to this many markers so the base map never has to render the full set at once. */
export const MAX_VISIBLE_POINTS = 60

const jsonFetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`)
  return res.json()
}

interface HidranteGeoJson {
  features: { properties: { fid: number }; geometry: { coordinates: [number, number] } }[]
}

function useSismologiaPoints(enabled: boolean) {
  const { data, error, isLoading } = useSWR<SismologiaEventosResponse>(
    enabled ? "/api/sismologia/eventos" : null,
    jsonFetcher,
    { revalidateOnFocus: false },
  )

  const features = (): LabPointFeature[] => {
    if (!data) return []
    const seen = new Set<string>()
    const all = [...data.sgcLive.events, ...data.usgs.events, ...data.sgc.events]
    const points: LabPointFeature[] = []
    for (const event of all) {
      if (seen.has(event.id)) continue
      seen.add(event.id)
      points.push({
        id: event.id,
        lon: event.lon,
        lat: event.lat,
        label: `M${event.magnitude.toFixed(1)}`,
        sublabel: event.place ?? new Date(event.time).toLocaleString("es-CO"),
        colorToken: magnitudeColorToken(event.magnitude),
        radius: magnitudeRadius(event.magnitude),
        sortKey: new Date(event.time).getTime(),
      })
    }
    return points.sort((a, b) => b.sortKey - a.sortKey)
  }

  return { points: enabled ? features() : [], isLoading: enabled && isLoading, error: enabled ? error : null }
}

function useHidrantesPoints(enabled: boolean) {
  const { data, error, isLoading } = useSWR<HidranteGeoJson>(
    enabled ? "/data/hidrantes/hidrantes-sevilla.geojson" : null,
    jsonFetcher,
    { revalidateOnFocus: false },
  )

  const features = (): LabPointFeature[] => {
    if (!data) return []
    return data.features.map((feature) => ({
      id: `hidrante-${feature.properties.fid}`,
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      label: `Hidrante #${feature.properties.fid}`,
      sublabel: "Red de hidrantes — Sevilla",
      colorToken: "chart-2",
      radius: 5,
      sortKey: feature.properties.fid,
    }))
  }

  return { points: enabled ? features() : [], isLoading: enabled && isLoading, error: enabled ? error : null }
}

/**
 * Loads the points layer matching `layer` (sismología or hidrantes),
 * returning the full normalized set plus a `visible` slice capped at
 * `MAX_VISIBLE_POINTS` for the map — callers needing the full set (the
 * "ver todas" modal) use `all` instead.
 */
export function useLabPoints(layer: LayerKey | null) {
  const sismologia = useSismologiaPoints(layer === "sismologia")
  const hidrantes = useHidrantesPoints(layer === "hidrantes")

  if (layer === "sismologia") {
    return { all: sismologia.points, visible: sismologia.points.slice(0, MAX_VISIBLE_POINTS), isLoading: sismologia.isLoading, error: sismologia.error }
  }
  if (layer === "hidrantes") {
    return { all: hidrantes.points, visible: hidrantes.points.slice(0, MAX_VISIBLE_POINTS), isLoading: hidrantes.isLoading, error: hidrantes.error }
  }
  return { all: [] as LabPointFeature[], visible: [] as LabPointFeature[], isLoading: false, error: null }
}
