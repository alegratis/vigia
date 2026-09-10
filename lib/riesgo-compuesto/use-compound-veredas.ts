"use client"

import useSWR from "swr"
import type { RiesgoCompuestoResponse } from "./api-types"

const fetcher = async (url: string): Promise<RiesgoCompuestoResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de riesgo compuesto")
  return res.json()
}

/**
 * Fetches the compound-risk vereda layer only when `enabled` is true — a
 * separate SWR key from `useVeredas()`, since this endpoint composes a
 * materially different payload (four hazards + narrative), not just the
 * boundary/hazard-summary shape /api/veredas returns.
 */
export function useCompoundVeredas(enabled: boolean) {
  const { data, error, isLoading } = useSWR<RiesgoCompuestoResponse>(
    enabled ? "/api/riesgo-compuesto/veredas" : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { veredas: data?.veredas ?? null, error, isLoading }
}
