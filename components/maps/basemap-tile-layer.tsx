"use client"

import { useTheme } from "next-themes"
import { TileLayer } from "react-leaflet"

const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const LIGHT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// Esri "World Dark Gray Canvas": free, keyless ArcGIS Online basemap, served
// as two stacked raster layers (base fill + reference labels/roads). Note
// the {z}/{y}/{x} tile order, which is reversed from the {z}/{x}/{y} used by
// OSM/CARTO-style servers.
//
// CARTO's basemaps.cartocdn.com/dark_all tiles were tried first, but CARTO
// now watermarks every tile "API KEY REQUIRED" without a Cloud/Enterprise
// account, so they aren't actually usable without a key despite being
// publicly reachable.
const DARK_BASE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
const DARK_REFERENCE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
const DARK_ATTRIBUTION = '&copy; <a href="https://www.esri.com/">Esri</a>'

/**
 * Base map tile layer shared by every live map. Renders standard OSM tiles
 * in light mode and Esri's World Dark Gray Canvas in dark mode, so the
 * basemap doesn't stay light-themed and blown-out inside the app's dark UI.
 */
export function BasemapTileLayer({ crossOrigin }: { crossOrigin?: true | "" | "anonymous" | "use-credentials" }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  if (isDark) {
    return (
      <>
        <TileLayer key="dark-base" attribution={DARK_ATTRIBUTION} url={DARK_BASE_URL} crossOrigin={crossOrigin} />
        <TileLayer key="dark-reference" url={DARK_REFERENCE_URL} crossOrigin={crossOrigin} />
      </>
    )
  }

  return <TileLayer key="light" attribution={LIGHT_ATTRIBUTION} url={LIGHT_TILE_URL} crossOrigin={crossOrigin} />
}
