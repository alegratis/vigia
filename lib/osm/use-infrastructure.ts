"use client"

import useSWR from "swr"
import { regionQuery } from "@/lib/lugares/region"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"
import type { OsmInfrastructureResponse } from "./api-types"

const fetcher = async (url: string): Promise<OsmInfrastructureResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la infraestructura de OpenStreetMap")
  return res.json()
}

/**
 * Single shared entry point for /api/osm/infraestructura. Scoped to the
 * selected municipio (Sevilla by default) via `?municipio=`. Every consumer
 * — the category breakdown, the building-name list, and each hazard's live
 * map (for markers) — calls this with the same region-derived SWR key, so
 * the underlying fetch, and the 6h server-side Overpass cache behind it,
 * only ever runs once per municipio no matter how many panels need the data.
 */
export function useOsmInfrastructure() {
  const { region } = useSelectedPlace()
  const { data, error, isLoading } = useSWR<OsmInfrastructureResponse>(
    `/api/osm/infraestructura${regionQuery(region)}`,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { points: data?.points ?? null, error, isLoading }
}
