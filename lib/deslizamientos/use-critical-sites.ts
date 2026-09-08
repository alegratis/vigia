"use client"

import useSWR from "swr"
import type { CriticalSitesResponse } from "./critical-sites-types"

const fetcher = async (url: string): Promise<CriticalSitesResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de sitios críticos")
  return res.json()
}

/**
 * Fetches "Sitios críticos" — field-surveyed road-damage points — only
 * when `enabled` is true, so the optional map overlay never costs a
 * request until the user actually toggles it on.
 */
export function useCriticalSites(enabled: boolean) {
  const { data, error, isLoading } = useSWR<CriticalSitesResponse>(
    enabled ? "/api/deslizamientos/sitios-criticos" : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  return { points: data?.points ?? null, surveyDate: data?.surveyDate ?? null, error, isLoading }
}
