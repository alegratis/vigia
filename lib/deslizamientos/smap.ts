/**
 * Configuration for NASA GIBS's SMAP L4 root-zone soil moisture — an open,
 * CORS-enabled WMTS tile service run by NASA EOSDIS. No API key needed; same
 * kind of publicly hosted tile source GWIS/EFFIS provides for the fire
 * weather index overlay (lib/incendios/gwis.ts).
 *
 * Layer `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture`: a continuous,
 * gap-filled land-surface model analysis (unlike raw SMAP swath products,
 * which have large data gaps and in some cases have been discontinued),
 * updated with a ~3-4 day latency. The `default` value for both the layer
 * version and the time dimension resolves to the most recent available
 * composite, so no day/time picker is needed.
 *
 * GIBS doesn't publish a machine-readable legend for this layer (unlike
 * GWIS's `GetLegendGraphic`), so the UI links out to NASA Worldview's own
 * color scale instead of fabricating one.
 *
 * No server import here — the map renders the WMTS tiles directly in the
 * browser via react-leaflet's TileLayer, same as the OSM basemap.
 */

export const SMAP_TILE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Root_Zone_Soil_Moisture/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png"

export const SMAP_WORLDVIEW_URL =
  "https://worldview.earthdata.nasa.gov/?v=-80,2,-72,8&l=SMAP_L4_Analyzed_Root_Zone_Soil_Moisture,Reference_Labels,Reference_Features,Coastlines"
