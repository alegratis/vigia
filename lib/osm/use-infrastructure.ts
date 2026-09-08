"use client"

import useSWR from "swr"
import type { OsmInfrastructureResponse } from "./api-types"

const fetcher = async (url: string): Promise<OsmInfrastructureResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la infraestructura de OpenStreetMap")
  return res.json()
}

/**
 * Single shared entry point for /api/osm/infraestructura. Every consumer —
 * the category breakdown, the building-name list, and each hazard's live
 * map (for markers) — calls this with the same SWR key, so the underlying
 * fetch, and the 6h server-side Overpass cache behind it, only ever runs
 * once per page no matter how many panels need the data.
 */
export function useOsmInfrastructure() {
  const { data, error, isLoading } = useSWR<OsmInfrastructureResponse>(
    "/api/osm/infraestructura",
    fetcher,
    { revalidateOnFocus: false },
  )
  return { points: data?.points ?? null, error, isLoading }
}
