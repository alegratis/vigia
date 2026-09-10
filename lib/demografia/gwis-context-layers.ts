/**
 * Configuration for two more public, CORS-enabled WMS layers from the same
 * GWIS (Global Wildfire Information System) / Copernicus EFFIS server
 * already used for the Fire Weather Index forecast, Sentinel-3 hotspots
 * (lib/incendios/gwis.ts) and MODIS land cover (lib/land-cover/gwis-landcover.ts).
 * No API key needed. These two are exposure/context layers rather than
 * hazard-specific ones, so — like land cover — they're shared across every
 * hazard map instead of living under one domain's lib folder.
 *
 * - `ghsl`: JRC's Global Human Settlement Layer, Built-Up product (GHS-BUILT-S2,
 *   derived from Sentinel-2), i.e. where people and structures actually are —
 *   demographic/exposure context for every hazard, not just one.
 * - `wdpa.poly_raw`: the World Database on Protected Areas' polygons
 *   (land/coastal/marine protected areas). `wdpa.poly` (the group layer) and
 *   its generalized sub-layers (`wdpa.poly_0_3`/`_0_03`/`_0_003`) are scale-
 *   gated for low zooms and render empty at this app's municipio-level zoom;
 *   `_raw` is the full-detail layer and is what actually renders here.
 */

export const GWIS_SETTLEMENT_LAYER = "ghsl"
export const GWIS_SETTLEMENT_LEGEND_URL =
  `https://maps.effis.emergency.copernicus.eu/gwis?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=${GWIS_SETTLEMENT_LAYER}&FORMAT=image/png`

export const GWIS_PROTECTED_AREAS_LAYER = "wdpa.poly_raw"
export const GWIS_PROTECTED_AREAS_LEGEND_URL =
  `https://maps.effis.emergency.copernicus.eu/gwis?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=${GWIS_PROTECTED_AREAS_LAYER}&FORMAT=image/png`
