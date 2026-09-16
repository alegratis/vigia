"use client"

import useSWR from "swr"
import { regionQuery } from "@/lib/lugares/region"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"
import type { VeredasResponse } from "./api-types"

const fetcher = async (url: string): Promise<VeredasResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de veredas")
  return res.json()
}

/**
 * Fetches vereda boundaries + hazard summary for the selected municipio
 * (study area by default) only when `enabled` is true, so this heavier
 * overlay (boundary decoding + spatial aggregation) never costs a request
 * until the user actually toggles it on. The region flows into the request
 * URL, so switching municipios refetches automatically.
 */
export function useVeredas(enabled: boolean) {
  const { region } = useSelectedPlace()
  const key = enabled ? `/api/veredas${regionQuery(region)}` : null
  const { data, error, isLoading } = useSWR<VeredasResponse>(key, fetcher, {
    revalidateOnFocus: false,
  })
  return { veredas: data?.veredas ?? null, error, isLoading }
}
