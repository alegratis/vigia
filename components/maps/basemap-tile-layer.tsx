"use client"

import { useTheme } from "next-themes"
import { TileLayer } from "react-leaflet"

const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const LIGHT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// CARTO Dark Matter: same OSM-derived vector data, dark-themed render, free
// and keyless — a drop-in swap for the light OSM raster tiles below.
const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
const DARK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

/**
 * Base map tile layer shared by every live map. Renders standard OSM tiles
 * in light mode and CARTO's Dark Matter tiles in dark mode, so the basemap
 * doesn't stay light-themed and blown-out inside the app's dark UI.
 */
export function BasemapTileLayer({ crossOrigin }: { crossOrigin?: true | "" | "anonymous" | "use-credentials" }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <TileLayer
      key={isDark ? "dark" : "light"}
      attribution={isDark ? DARK_ATTRIBUTION : LIGHT_ATTRIBUTION}
      url={isDark ? DARK_TILE_URL : LIGHT_TILE_URL}
      crossOrigin={crossOrigin}
    />
  )
}
