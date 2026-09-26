import type { StyleSpecification } from "maplibre-gl"

/**
 * The four basemap themes exposed via `MapBasemapControl`, independent of
 * the 2D/3D pitch toggle:
 * - `osm`: OpenStreetMap standard street tiles.
 * - `hybrid`: satellite imagery with a boundaries/labels overlay on top.
 * - `dark`: a low-luminance basemap for dark-mode viewing.
 * - `satellite`: plain satellite imagery, no labels.
 */
export type BasemapType = "osm" | "hybrid" | "dark" | "satellite"

// OSM's `{s}` subdomains (a/b/c) expanded into one raster source with three
// URL templates, since MapLibre raster sources don't support Leaflet's `{s}`
// placeholder the way react-leaflet's <TileLayer> does.
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTRIBUTION = "© OpenStreetMap contributors"

// The dark-mode vector style used in 2D: OpenFreeMap's hosted "dark" style
// is free, keyless, and — being vector rather than pre-rendered raster
// tiles — has crisp labels at any zoom. It's fetched by MapLibre itself as
// a complete style document, so it can't have the terrain/hillshade/sky
// block below merged into it; the 3D dark variant swaps to the raster Esri
// Dark Gray Canvas pair instead (see `ESRI_DARK_*` below) so 3D dark can
// still carry real elevation.
const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark"

// Esri's keyless "World Imagery" REST tile service — used for both the
// plain `satellite` theme and as the imagery half of `hybrid`.
const ESRI_SATELLITE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
const ESRI_SATELLITE_ATTRIBUTION = "© Esri, Maxar, Earthstar Geographics"

// Esri's keyless labels/boundaries overlay, drawn as a transparent raster
// layer on top of `World_Imagery` to produce the "hybrid" look (imagery +
// place names + admin boundaries) without a vector basemap.
const ESRI_HYBRID_LABELS_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
const ESRI_HYBRID_LABELS_ATTRIBUTION = "© Esri, Garmin, USGS, NGA, NOAA"

// Esri's keyless "Dark Gray Canvas" base + reference pair — the 3D-only
// stand-in for the vector `DARK_STYLE_URL` above, since it's raster and can
// be built synchronously alongside the terrain DEM source in the same
// style document.
const ESRI_DARK_BASE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
const ESRI_DARK_REFERENCE_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
const ESRI_DARK_ATTRIBUTION = "© Esri, HERE, Garmin, FAO, NOAA, USGS"

// AWS's public-domain "Terrain Tiles" open dataset (the surviving mirror of
// Mapzen/Tilezen's elevation-tiles-prod bucket) — a keyless `raster-dem`
// source in Terrarium encoding, world-wide coverage, no signup required.
// This is what actually gives the 3D view real relief: MapLibre's `terrain`
// property displaces the map surface using this DEM, so hills and valleys
// rise and dip instead of the basemap imagery just being a flat texture
// under a tilted camera.
const TERRAIN_DEM_TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
const TERRAIN_ATTRIBUTION = "Terrain data: Mapzen Terrain Tiles / AWS Open Data (SRTM, NASA, USGS, ESA)"

const TILE_SIZE = 256

function rasterSource(tileUrls: string[], attribution: string) {
  return { type: "raster" as const, tiles: tileUrls, tileSize: TILE_SIZE, attribution }
}

/**
 * Builds the MapLibre basemap style for the given theme, in either 2D
 * (flat) or 3D (terrain-draped, tilted) mode. `dark` is the only theme that
 * changes tile source between the two modes — see the `DARK_STYLE_URL`
 * comment above — every other theme reuses the same imagery in both modes
 * and just gains the terrain/hillshade/sky block when `is3D` is true.
 *
 * MapBiomas (colombia.mapbiomas.org) was evaluated as a source but doesn't
 * expose a public WMS/XYZ tile service — it distributes land-cover data
 * only via Google Earth Engine assets and downloadable GeoTIFFs — so it
 * isn't usable as a live basemap tile source here.
 */
export function maplibreMapStyle(basemap: BasemapType, is3D: boolean): StyleSpecification | string {
  if (basemap === "dark" && !is3D) return DARK_STYLE_URL

  const sources: StyleSpecification["sources"] = {}
  const layers: StyleSpecification["layers"] = []

  switch (basemap) {
    case "osm":
      sources["osm"] = rasterSource(["a", "b", "c"].map((s) => OSM_TILE_URL.replace("{s}", s)), OSM_ATTRIBUTION)
      layers.push({ id: "osm", type: "raster", source: "osm" })
      break
    case "dark":
      sources["esri-dark-base"] = rasterSource([ESRI_DARK_BASE_TILE_URL], ESRI_DARK_ATTRIBUTION)
      sources["esri-dark-reference"] = rasterSource([ESRI_DARK_REFERENCE_TILE_URL], ESRI_DARK_ATTRIBUTION)
      layers.push({ id: "esri-dark-base", type: "raster", source: "esri-dark-base" })
      layers.push({ id: "esri-dark-reference", type: "raster", source: "esri-dark-reference" })
      break
    case "hybrid":
      sources["esri-satellite"] = rasterSource([ESRI_SATELLITE_TILE_URL], ESRI_SATELLITE_ATTRIBUTION)
      sources["esri-hybrid-labels"] = rasterSource([ESRI_HYBRID_LABELS_TILE_URL], ESRI_HYBRID_LABELS_ATTRIBUTION)
      layers.push({ id: "esri-satellite", type: "raster", source: "esri-satellite" })
      layers.push({ id: "esri-hybrid-labels", type: "raster", source: "esri-hybrid-labels" })
      break
    case "satellite":
      sources["esri-satellite"] = rasterSource([ESRI_SATELLITE_TILE_URL], ESRI_SATELLITE_ATTRIBUTION)
      layers.push({ id: "esri-satellite", type: "raster", source: "esri-satellite" })
      break
  }

  if (!is3D) return { version: 8, sources, layers }

  sources["terrain-dem"] = {
    type: "raster-dem",
    tiles: [TERRAIN_DEM_TILE_URL],
    tileSize: 256,
    encoding: "terrarium",
    maxzoom: 15,
    attribution: TERRAIN_ATTRIBUTION,
  }
  layers.push({
    id: "terrain-hillshade",
    type: "hillshade",
    source: "terrain-dem",
    paint: {
      "hillshade-exaggeration": 0.5,
      "hillshade-shadow-color": "#1a1006",
      "hillshade-highlight-color": "#fff8e6",
    },
  })

  return {
    version: 8,
    sources,
    layers,
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
