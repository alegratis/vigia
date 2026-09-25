import type { StyleSpecification } from "maplibre-gl"

// Mirrors components/maps/basemap-tile-layer.tsx exactly (same tile URLs,
// same light/dark split) so the MapLibre spike map looks identical to the
// Leaflet maps it sits alongside. MapLibre has no per-TileLayer swap like
// react-leaflet's <TileLayer>; a full style-document swap is its
// equivalent, so this returns a whole `StyleSpecification` per theme
// instead of just a URL.

const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const LIGHT_ATTRIBUTION = "© OpenStreetMap contributors"

// Esri "World Dark Gray Canvas", stacked base + reference layers — same
// keyless ArcGIS Online basemap and tile order ({z}/{y}/{x}) as the
// Leaflet dark basemap.
const DARK_BASE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
const DARK_REFERENCE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
const DARK_ATTRIBUTION = "© Esri"

const TILE_SIZE = 256

/**
 * Builds a MapLibre basemap `StyleSpecification` for light or dark mode.
 * OSM subdomains (a/b/c) are expanded into one raster source with three
 * URL templates, since MapLibre raster sources don't support Leaflet's
 * `{s}` subdomain placeholder.
 */
export function maplibreBasemapStyle(isDark: boolean): StyleSpecification {
  if (isDark) {
    return {
      version: 8,
      sources: {
        "dark-base": {
          type: "raster",
          tiles: [DARK_BASE_URL],
          tileSize: TILE_SIZE,
          attribution: DARK_ATTRIBUTION,
        },
        "dark-reference": {
          type: "raster",
          tiles: [DARK_REFERENCE_URL],
          tileSize: TILE_SIZE,
        },
      },
      layers: [
        { id: "dark-base", type: "raster", source: "dark-base" },
        { id: "dark-reference", type: "raster", source: "dark-reference" },
      ],
    }
  }

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
