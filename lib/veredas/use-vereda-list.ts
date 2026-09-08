"use client"

import useSWR from "swr"
import type { VeredaListResponse } from "./list-api-types"

const fetcher = async (url: string): Promise<VeredaListResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la lista de veredas")
  return res.json()
}

/**
 * Fetches the lightweight municipio/vereda index for the "Conoce tu nivel
 * de exposición" picker. Always enabled (unlike useVeredas, which gates a
 * much heavier full-aggregation fetch behind a map toggle) since this is
 * the first thing the popup needs to render its dropdowns.
 */
export function useVeredaList() {
  const { data, error, isLoading } = useSWR<VeredaListResponse>("/api/veredas/lista", fetcher, {
    revalidateOnFocus: false,
  })
  return { veredas: data?.veredas ?? null, error, isLoading }
}
