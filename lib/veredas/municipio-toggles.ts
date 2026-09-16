"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { MUNICIPIOS, normalizeMunicipioName } from "@/lib/demografia/categories"
import { getMunicipioByCode } from "@/lib/lugares/registry"
import type { Region } from "@/lib/lugares/region"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"

export { MUNICIPIOS }

/**
 * The municipio name(s) to show for a region — the selected municipio.
 * Shared by the toggle hook and the toggle panel so both stay in sync with
 * the selection.
 */
export function municipioNamesForRegion(region: Region): string[] {
  return region.codes.map((c) => getMunicipioByCode(c)?.name).filter((n): n is string => Boolean(n))
}

/** Initial toggle state for a municipio set: the first one on, the rest off. */
function initActive(municipios: string[]): Record<string, boolean> {
  const state: Record<string, boolean> = {}
  municipios.forEach((m, i) => {
    state[m] = i === 0
  })
  return state
}

export interface MunicipioToggleState {
  /** Per-municipio on/off map, keyed by the canonical title-case name. */
  active: Record<string, boolean>
  /** The subset of the region's municipios currently toggled on. */
  activeMunicipios: string[]
  /** The municipios available to toggle for the current selection. */
  municipios: string[]
  toggle: (municipio: string) => void
}

/**
 * Independent on/off toggles for the selected region's municipios. For the
 * study-area default this is Sevilla (on) plus Caicedonia and Zarzal (off),
 * matching the previous behavior; nationally it is just the selected
 * municipio. The toggle state resets whenever the selection changes.
 */
export function useMunicipioToggles(): MunicipioToggleState {
  const { region } = useSelectedPlace()
  const municipios = useMemo(() => municipioNamesForRegion(region), [region])
  const key = municipios.join("|")

  const [active, setActive] = useState<Record<string, boolean>>(() => initActive(municipios))

  // Reset toggles when the selected place changes which municipios exist.
  useEffect(() => {
    setActive(initActive(municipios))
    // `key` is the stable string form of `municipios`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const toggle = useCallback((municipio: string) => {
    setActive((prev) => ({ ...prev, [municipio]: !prev[municipio] }))
  }, [])

  const activeMunicipios = useMemo(() => municipios.filter((m) => active[m]), [municipios, active])

  return { active, activeMunicipios, municipios, toggle }
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
