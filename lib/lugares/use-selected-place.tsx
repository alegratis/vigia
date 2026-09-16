"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { resolveRegion, type Region } from "./region"

interface SelectedPlaceValue {
  /** Selected municipio code, or null for the study-area default. */
  municipioCode: string | null
  /** Region derived from the selection (codes, framing, label). */
  region: Region
  setMunicipioCode: (code: string | null) => void
}

const SelectedPlaceContext = createContext<SelectedPlaceValue | null>(null)

/**
 * Holds the nationally-selected municipio and persists it to the URL
 * (`?mun=<code>`) with history.replaceState — no navigation, so maps and
 * SWR hooks re-derive their region without a full page reload. Provided
 * around the hazard workspace; consumers elsewhere (e.g. the exposición
 * popup) fall back to the study-area default via `useSelectedPlace`.
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

  const region = useMemo(() => resolveRegion(municipioCode), [municipioCode])

  const value = useMemo<SelectedPlaceValue>(
    () => ({ municipioCode, region, setMunicipioCode }),
    [municipioCode, region, setMunicipioCode],
  )

  return <SelectedPlaceContext.Provider value={value}>{children}</SelectedPlaceContext.Provider>
}

const STUDY_AREA_FALLBACK: SelectedPlaceValue = {
  municipioCode: null,
  region: resolveRegion(null),
  setMunicipioCode: () => {},
}

/**
 * Reads the selected place. Non-throwing on purpose: components rendered
 * outside a provider (the exposición popup route) transparently get the
 * study-area default rather than crashing.
 */
export function useSelectedPlace(): SelectedPlaceValue {
  return useContext(SelectedPlaceContext) ?? STUDY_AREA_FALLBACK
}
