"use client"

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { useTheme } from "next-themes"
import { defaultBasemapForCurrentTheme, type BasemapType } from "@/lib/maps/maplibre-basemap-style"

/**
 * Same `basemap` state every map already had (`useState<BasemapType>(defaultBasemapForCurrentTheme)`),
 * but it keeps tracking the app's light/dark theme afterwards instead of only reading it once on mount.
 *
 * Switching the app theme swaps `osm` <-> `dark` (CARTO dark in dark mode, standard OSM in light mode) so
 * the basemap always matches the current theme by default. `satellite` and `hybrid` are imagery-based, not
 * light/dark, so a theme change never overrides either of them — the user's explicit choice sticks until
 * they pick something else in `MapBasemapControl`.
 */
export function useThemeSyncedBasemap(): [BasemapType, Dispatch<SetStateAction<BasemapType>>] {
  const [basemap, setBasemap] = useState<BasemapType>(defaultBasemapForCurrentTheme)
  const { resolvedTheme } = useTheme()
  const previousThemeRef = useRef(resolvedTheme)

  useEffect(() => {
    if (resolvedTheme === previousThemeRef.current) return
    previousThemeRef.current = resolvedTheme

    setBasemap((current) => {
      if (current === "satellite" || current === "hybrid") return current
      return resolvedTheme === "dark" ? "dark" : "osm"
    })
  }, [resolvedTheme])

  return [basemap, setBasemap]
}
