import type { StyleSpecification } from "maplibre-gl"

// The light style mirrors components/maps/basemap-tile-layer.tsx (same OSM
// tile URL) so this MapLibre spike map matches the Leaflet maps it sits
// alongside. MapLibre has no per-TileLayer swap like react-leaflet's
// <TileLayer>; a full style-document swap is its equivalent, so this
// returns a whole style (or a URL MapLibre resolves into one) per theme
// instead of just a tile URL.
//
// The dark style intentionally diverges from the Leaflet maps' Esri "World
// Dark Gray Canvas": Esri's canvas renders flat and low-contrast, and
// CARTO's raster Dark Matter tiles (the initial replacement) now print an
// "API key required" watermark on their no-signup tier. OpenFreeMap's
// hosted "dark" vector style is free, keyless, and — being vector rather
// than pre-rendered raster tiles — has proper crisp labels at any zoom.
// Leaflet's dark basemap (basemap-tile-layer.tsx) stays on Esri until the
// full migration off Leaflet revisits it.
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark"

const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const LIGHT_ATTRIBUTION = "© OpenStreetMap contributors"
const TILE_SIZE = 256

/**
 * Builds a MapLibre basemap style for light or dark mode. Dark mode hands
 * back OpenFreeMap's hosted style URL directly — react-map-gl's `mapStyle`
 * accepts a URL and fetches/parses it itself. Light mode still builds its
 * own raster `StyleSpecification`, with OSM's `{s}` subdomains (a/b/c)
 * expanded into one raster source with three URL templates, since MapLibre
 * raster sources don't support Leaflet's `{s}` placeholder.
 */
export function maplibreBasemapStyle(isDark: boolean): StyleSpecification | string {
  if (isDark) return DARK_STYLE_URL

  return {
    version: 8,
    sources: {
      "osm-light": {
        type: "raster",
        tiles: ["a", "b", "c"].map((s) => LIGHT_TILE_URL.replace("{s}", s)),
        tileSize: TILE_SIZE,
        attribution: LIGHT_ATTRIBUTION,
      },
    },
    layers: [{ id: "osm-light", type: "raster", source: "osm-light" }],
  }
}
