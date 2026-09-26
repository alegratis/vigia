"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import type { MapBounds } from "@/lib/map-bounds"
import type { FaultsResponse } from "./fault-types"

const fetcher = async (url: string): Promise<FaultsResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de fallas geológicas")
  return res.json()
}

type Envelope = [minLon: number, minLat: number, maxLon: number, maxLat: number]

// Extra margin around the requested viewport, as a fraction of its own
// width/height, so a small pan or zoom near the edge of what's already
// loaded doesn't immediately trigger another fetch.
const PADDING_FACTOR = 0.5

function padToEnvelope(bounds: MapBounds): Envelope {
  const width = bounds.east - bounds.west
  const height = bounds.north - bounds.south
  return [
    bounds.west - width * PADDING_FACTOR,
    bounds.south - height * PADDING_FACTOR,
    bounds.east + width * PADDING_FACTOR,
    bounds.north + height * PADDING_FACTOR,
  ]
}

function contains(outer: Envelope, inner: Envelope): boolean {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3]
}

function union(a: Envelope, b: Envelope): Envelope {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

/**
 * Fetches the SGC geological faults layer only when `enabled` is true — the
 * same lazy pattern as use-critical-sites.ts — and grows the queried
 * envelope to follow `bounds` (the live map's current viewport) as the user
 * zooms or pans out, instead of clipping the layer to the small local AOI
 * the hazard model uses. The envelope only ever grows: panning or zooming
 * back into an area it already covers reuses the cached response with no
 * extra request, and each grown envelope is a superset of the previous
 * one, so the latest response always includes everything the layer showed
 * before it.
 */
export function useFaults(enabled: boolean, bounds: MapBounds | null) {
  const [envelope, setEnvelope] = useState<Envelope | null>(null)

  useEffect(() => {
    if (!enabled || !bounds) return
    const needed = padToEnvelope(bounds)
    setEnvelope((current) => (current && contains(current, needed) ? current : current ? union(current, needed) : needed))
  }, [enabled, bounds])

  const key =
    enabled && envelope
      ? `/api/deslizamientos/fallas?bbox=${envelope.map((n) => n.toFixed(4)).join(",")}`
      : null
  const { data, error, isLoading } = useSWR<FaultsResponse>(key, fetcher, { revalidateOnFocus: false })
  return { traces: data?.traces ?? null, error, isLoading }
}
