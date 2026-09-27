"use client"

import useSWR from "swr"
import type { BarriosResponse } from "./api-types"

const fetcher = async (url: string): Promise<BarriosResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "No se pudo cargar los barrios de Sevilla")
  }
  return res.json()
}

/**
 * Fetches Sevilla's neighborhood (barrio) boundaries only while `enabled`,
 * mirroring `useVeredas`'s gate pattern so this layer never costs a request
 * until a map that shows it is actually active.
 */
export function useBarrios(enabled: boolean) {
  const { data, error, isLoading } = useSWR<BarriosResponse>(enabled ? "/api/barrios" : null, fetcher, {
    revalidateOnFocus: false,
  })
  return { data, error, isLoading }
}
