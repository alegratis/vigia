"use client"

import useSWR from "swr"
import type { VeredasResponse } from "./api-types"

const fetcher = async (url: string): Promise<VeredasResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de veredas")
  return res.json()
}

/**
 * Fetches vereda boundaries + hazard summary only when `enabled` is true,
 * so this heavier overlay (boundary decoding + spatial aggregation) never
 * costs a request until the user actually toggles it on.
 */
export function useVeredas(enabled: boolean) {
  const { data, error, isLoading } = useSWR<VeredasResponse>(enabled ? "/api/veredas" : null, fetcher, {
    revalidateOnFocus: false,
  })
  return { veredas: data?.veredas ?? null, error, isLoading }
}
