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

function area(e: Envelope): number {
  return (e[2] - e[0]) * (e[3] - e[1])
}

// How much larger the cached envelope is allowed to be than what the
// current viewport actually needs before it's considered stale. The SGC
// FeatureServer caps how many features it returns per query, so a huge
// envelope fetched while zoomed way out can come back truncated in a way
// that drops fine local traces — reusing that same response after zooming
// back in would make those traces look like they "disappeared". Keeping
// this ratio small forces a fresh, tightly-scoped request once the
// viewport has shrunk enough to want that detail back.
const MAX_STALE_AREA_RATIO = 2.5

/**
 * Fetches the SGC geological faults layer only when `enabled` is true — the
 * same lazy pattern as use-critical-sites.ts — and re-queries around
 * `bounds` (the live map's current viewport) every time it changes enough
 * to matter, instead of clipping the layer to the small local AOI the
 * hazard model uses. Panning or zooming only slightly reuses the cached
 * response with no extra request; zooming out far enough to need more
 * coverage, or back in far enough that the cached envelope is now much
 * bigger than the viewport (and so may be missing local detail dropped by
 * the server's feature-count cap), triggers a fresh, right-sized fetch.
 */
export function useFaults(enabled: boolean, bounds: MapBounds | null) {
  const [envelope, setEnvelope] = useState<Envelope | null>(null)

  useEffect(() => {
    if (!enabled || !bounds) return
    const needed = padToEnvelope(bounds)
    setEnvelope((current) => {
      if (!current) return needed
      const stillCovers = contains(current, needed)
      const stillTight = area(current) / area(needed) <= MAX_STALE_AREA_RATIO
      return stillCovers && stillTight ? current : needed
    })
  }, [enabled, bounds])

  const key =
    enabled && envelope
      ? `/api/deslizamientos/fallas?bbox=${envelope.map((n) => n.toFixed(4)).join(",")}`
      : null
  const { data, error, isLoading } = useSWR<FaultsResponse>(key, fetcher, { revalidateOnFocus: false })
  return { traces: data?.traces ?? null, error, isLoading }
}
