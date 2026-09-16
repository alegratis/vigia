"use client"

import useSWR from "swr"
import { regionQuery } from "@/lib/lugares/region"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"
import type { FaultsResponse } from "./fault-types"

const fetcher = async (url: string): Promise<FaultsResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de fallas geológicas")
  return res.json()
}

/**
 * Fetches the SGC geological faults layer for the selected municipio only
 * when `enabled` is true, so the optional map overlay never costs a request
 * until the user actually toggles it on — same pattern as
 * use-critical-sites.ts.
 */
export function useFaults(enabled: boolean) {
  const { region } = useSelectedPlace()
  const { data, error, isLoading } = useSWR<FaultsResponse>(
    enabled ? `/api/deslizamientos/fallas${regionQuery(region)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { traces: data?.traces ?? null, error, isLoading }
}
