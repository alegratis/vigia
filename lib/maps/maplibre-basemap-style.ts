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

// Esri's keyless "World Imagery" REST tile service — the same satellite
// basemap used by the Leaflet maps' light theme, reused here for the
// tilted 3D perspective where imagery reads better than flat OSM/vector
// street tiles. Esri's z/y/x tile order (not the usual z/x/y).
const ESRI_SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const ESRI_SATELLITE_ATTRIBUTION = "© Esri, Maxar, Earthstar Geographics"

// AWS's public-domain "Terrain Tiles" open dataset (the surviving mirror of
// Mapzen/Tilezen's elevation-tiles-prod bucket) — a keyless `raster-dem`
// source in Terrarium encoding, world-wide coverage, no signup required.
// This is what actually gives the 3D view real relief: MapLibre's `terrain`
// property displaces the map surface using this DEM, so hills and valleys
// rise and dip instead of the satellite/OSM imagery just being a flat
// texture under a tilted camera.
const TERRAIN_DEM_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
const TERRAIN_ATTRIBUTION = "Terrain data: Mapzen Terrain Tiles / AWS Open Data (SRTM, NASA, USGS, ESA)"

/**
 * Builds the 3D-mode basemap: Esri satellite imagery draped over real
 * elevation data, plus a `hillshade` layer computed from the same DEM for
 * extra topographic definition ("Esri satellite combined with topography",
 * per the request) and a `sky` layer so the tilted horizon doesn't cut off
 * into void. Used instead of `maplibreBasemapStyle` only while the map is
 * pitched into 3D — 2D stays on the light/dark OSM/vector basemaps above,
 * which have no elevation displacement and no need for one.
 *
 * MapBiomas (colombia.mapbiomas.org) was evaluated as a source but doesn't
 * expose a public WMS/XYZ tile service — it distributes land-cover data
 * only via Google Earth Engine assets and downloadable GeoTIFFs — so it
 * isn't usable as a live basemap tile source here.
 */
export function maplibreSatelliteTerrainStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      "esri-satellite": {
        type: "raster",
        tiles: [ESRI_SATELLITE_TILE_URL],
        tileSize: 256,
        attribution: ESRI_SATELLITE_ATTRIBUTION,
      },
      "terrain-dem": {
        type: "raster-dem",
        tiles: [TERRAIN_DEM_TILE_URL],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
        attribution: TERRAIN_ATTRIBUTION,
      },
    },
    layers: [
      { id: "esri-satellite", type: "raster", source: "esri-satellite" },
      {
        id: "terrain-hillshade",
        type: "hillshade",
        source: "terrain-dem",
        paint: {
          "hillshade-exaggeration": 0.5,
          "hillshade-shadow-color": "#1a1006",
          "hillshade-highlight-color": "#fff8e6",
        },
      },
    ],
    // `sky` is a top-level style property (not a layer type) as of the
    // MapLibre style spec used here — it renders the atmosphere above the
    // tilted horizon so the 3D view doesn't cut off into void.
    sky: {
      "sky-color": "#0a1a33",
      "horizon-color": "#c9d9e8",
      "fog-color": "#c9d9e8",
      "horizon-fog-blend": 0.5,
      "sky-horizon-blend": 0.5,
      "atmosphere-blend": 0.8,
    },
    terrain: { source: "terrain-dem", exaggeration: 1.4 },
  }
}
