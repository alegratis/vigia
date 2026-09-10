"use client"

import useSWR from "swr"
import type { SismologiaDanosResponse, SismologiaEventosResponse } from "./api-types"

const eventosFetcher = async (url: string): Promise<SismologiaEventosResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la actividad sísmica")
  return res.json()
}

export function useSismologiaEventos() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<SismologiaEventosResponse>(
    "/api/sismologia/eventos",
    eventosFetcher,
    { revalidateOnFocus: false },
  )
  return { data, error, isLoading, isValidating, mutate }
}

const danosFetcher = async (url: string): Promise<SismologiaDanosResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar los reportes de daños")
  return res.json()
}

/** Only fetched when `enabled` — the Sevilla damage-reports overlay is opt-in on the map. */
export function useSismologiaDanos(enabled: boolean) {
  const { data, error, isLoading } = useSWR<SismologiaDanosResponse>(
    enabled ? "/api/sismologia/danos" : null,
    danosFetcher,
    { revalidateOnFocus: false },
  )
  return { data, error, isLoading }
}
