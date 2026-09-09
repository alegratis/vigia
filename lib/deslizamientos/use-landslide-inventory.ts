"use client"

import useSWR from "swr"
import type { LandslideInventoryResponse } from "./landslide-inventory-types"

const fetcher = async (url: string): Promise<LandslideInventoryResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar el inventario histórico de movimientos en masa")
  return res.json()
}

/**
 * Fetches the SGC historical mass-movement inventory only when `enabled`
 * is true, so the optional map overlay never costs a request until the
 * user actually toggles it on — same pattern as use-faults.ts.
 */
export function useLandslideInventory(enabled: boolean) {
  const { data, error, isLoading } = useSWR<LandslideInventoryResponse>(
    enabled ? "/api/deslizamientos/inventario" : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { records: data?.records ?? null, error, isLoading }
}
