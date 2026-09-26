"use client"

import useSWR from "swr"
import type { DemografiaGeoportalResponse } from "./geoportal-api-types"

const fetcher = async (url: string): Promise<DemografiaGeoportalResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "No se pudo cargar los indicadores del geoportal de DANE")
  }
  return res.json()
}

/**
 * Fetches both DANE geoportal indicators (pobreza multidimensional por
 * municipio, viviendas/hogares/personas por manzana) in one request —
 * mirrors `useVeredas`'s enabled-gate pattern so the Demografía tab's map
 * only pays for this fetch while it's the active category.
 */
export function useDemografiaGeoportal(enabled: boolean) {
  const { data, error, isLoading } = useSWR<DemografiaGeoportalResponse>(
    enabled ? "/api/demografia-geoportal" : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { data, error, isLoading }
}
