"use client"

import useSWR from "swr"
import type { VulnerabilidadResponse } from "./api-types"

const fetcher = async (url: string): Promise<VulnerabilidadResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "No se pudo calcular el índice de vulnerabilidad")
  }
  return res.json()
}

/** Same enabled-gate pattern as useDemografiaGeoportal/useVeredas — only fetches while the Demografía tab's third toggle is active. */
export function useVulnerabilidad(enabled: boolean) {
  const { data, error, isLoading } = useSWR<VulnerabilidadResponse>(
    enabled ? "/api/vulnerabilidad" : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { data, error, isLoading }
}
