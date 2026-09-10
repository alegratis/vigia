/**
 * Configuration for GWIS (Global Wildfire Information System) / Copernicus
 * EFFIS's public MODIS MCD12Q1 land-cover layer — the same open, CORS-
 * enabled WMS server already used for the Fire Weather Index forecast and
 * Sentinel-3 hotspots (see lib/incendios/gwis.ts). No API key needed.
 *
 * This was added as a stand-in for MapBiomas Colombia's land-cover/
 * vegetation/crop classification, which is published only as Google Earth
 * Engine assets with no public REST/WMS/download endpoint — see the
 * project chat history for that investigation. MCD12Q1 is coarser (500m,
 * global) and reclassified into five broad classes rather than MapBiomas'
 * detailed crop-level taxonomy, but it's live, dynamically served, and
 * needs no new credentials, so it's usable as vegetation/ground-cover
 * context for both the fire and landslide maps today.
 *
 * Layer `landcover.mcd12.<year>`: reclassified into five classes (Forest,
 * Savanna, Shrubland & Grassland, Cropland, Other) — see the legend at
 * GWIS_LANDCOVER_LEGEND_URL. GWIS keeps one layer per year; 2024 is the
 * most recent year with a serving layer as of this writing.
 */

export const GWIS_LANDCOVER_YEAR = 2024
export const GWIS_LANDCOVER_LAYER = `landcover.mcd12.${GWIS_LANDCOVER_YEAR}`

export const GWIS_LANDCOVER_LEGEND_URL =
  `https://maps.effis.emergency.copernicus.eu/gwis?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=${GWIS_LANDCOVER_LAYER}&FORMAT=image/png`
