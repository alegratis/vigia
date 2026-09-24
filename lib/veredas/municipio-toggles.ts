"use client"

import { useCallback, useMemo, useState } from "react"
import { MUNICIPIOS, normalizeMunicipioName } from "@/lib/demografia/categories"

export { MUNICIPIOS }

/**
 * Per-map municipality highlight state, shared by every hazard map. Sevilla
 * starts on, the rest start off — toggling one highlights that
 * municipality's veredas and surfaces its risk factors, leaving the others
 * drawn but dimmed (see `isMunicipioActive` + the overlays' dimmed styling).
 */
export const DEFAULT_ACTIVE_MUNICIPIOS: Record<string, boolean> = {
  Sevilla: true,
  Caicedonia: false,
  Zarzal: false,
  Roldanillo: false,
}

export interface MunicipioToggleState {
  /** Per-municipio on/off map, keyed by the canonical title-case name. */
  active: Record<string, boolean>
  /** The subset of MUNICIPIOS currently toggled on, in MUNICIPIOS order. */
  activeMunicipios: string[]
  toggle: (municipio: string) => void
}

/** Independent on/off toggles for each study-area municipality (Sevilla default on). */
export function useMunicipioToggles(): MunicipioToggleState {
  const [active, setActive] = useState<Record<string, boolean>>(() => ({ ...DEFAULT_ACTIVE_MUNICIPIOS }))

  const toggle = useCallback((municipio: string) => {
    setActive((prev) => ({ ...prev, [municipio]: !prev[municipio] }))
  }, [])

  const activeMunicipios = useMemo(() => MUNICIPIOS.filter((m) => active[m]), [active])

  return { active, activeMunicipios, toggle }
}

/**
 * Whether a vereda's municipio should render highlighted (vs. dimmed). An
 * empty selection counts every municipio as active, so a map with all
 * toggles off never goes fully grey/blank — it just shows nothing
 * emphasized. Matches case-insensitively via `normalizeMunicipioName`, since
 * some layers carry ArcGIS-cased names (e.g. "SEVILLA").
 */
export function isMunicipioActive(municipio: string, activeMunicipios: string[]): boolean {
  if (activeMunicipios.length === 0) return true
  const canonical = normalizeMunicipioName(municipio)
  return activeMunicipios.some((m) => m.toLowerCase() === canonical.toLowerCase())
}
