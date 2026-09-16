"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { DEFAULT_MUNICIPIO_CODE } from "./registry"
import { resolveRegion, type Region } from "./region"

interface SelectedPlaceValue {
  /** Selected municipio code, or null before an explicit choice (resolves to the Sevilla default). */
  municipioCode: string | null
  /** The effective municipio code actually in use — never null (falls back to Sevilla). */
  effectiveCode: string
  /** Region derived from the selection (code, framing, label). */
  region: Region
  setMunicipioCode: (code: string | null) => void
}

const SelectedPlaceContext = createContext<SelectedPlaceValue | null>(null)

/**
 * Holds the nationally-selected municipio and persists it to the URL
 * (`?mun=<code>`) with history.replaceState — no navigation, so maps and
 * SWR hooks re-derive their region without a full page reload. Provided
 * around the hazard workspace; consumers elsewhere (e.g. the exposición
 * popup) fall back to the Sevilla default via `useSelectedPlace`.
 */
export function SelectedPlaceProvider({
  children,
  initialCode = null,
}: {
  children: ReactNode
  initialCode?: string | null
}) {
  const [municipioCode, setCode] = useState<string | null>(initialCode)

  const setMunicipioCode = useCallback((code: string | null) => {
    setCode(code)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (code) url.searchParams.set("mun", code)
    else url.searchParams.delete("mun")
    window.history.replaceState(null, "", url.toString())
  }, [])

  const effectiveCode = municipioCode ?? DEFAULT_MUNICIPIO_CODE
  const region = useMemo(() => resolveRegion(effectiveCode), [effectiveCode])

  const value = useMemo<SelectedPlaceValue>(
    () => ({ municipioCode, effectiveCode, region, setMunicipioCode }),
    [municipioCode, effectiveCode, region, setMunicipioCode],
  )

  return <SelectedPlaceContext.Provider value={value}>{children}</SelectedPlaceContext.Provider>
}

const DEFAULT_FALLBACK: SelectedPlaceValue = {
  municipioCode: null,
  effectiveCode: DEFAULT_MUNICIPIO_CODE,
  region: resolveRegion(DEFAULT_MUNICIPIO_CODE),
  setMunicipioCode: () => {},
}

/**
 * Reads the selected place. Non-throwing on purpose: components rendered
 * outside a provider (the exposición popup route) transparently get the
 * Sevilla default rather than crashing.
 */
export function useSelectedPlace(): SelectedPlaceValue {
  return useContext(SelectedPlaceContext) ?? DEFAULT_FALLBACK
}
