/**
 * Configuration for NASA GIBS's GPM IMERG half-hourly precipitation rate —
 * an open, CORS-enabled WMTS tile service run by NASA EOSDIS. No API key
 * needed; same kind of publicly hosted tile source GWIS/EFFIS provides for
 * the fire weather index overlay (lib/incendios/gwis.ts).
 *
 * Layer `IMERG_Precipitation_Rate_30min`: live, global 2 km precipitation
 * rate grid, updated on a ~30-minute cadence. The `default` value for both
 * the layer version and the time dimension resolves to the most recent
 * available composite, so no day/time picker is needed.
 *
 * GIBS doesn't publish a machine-readable legend for this layer (unlike
 * GWIS's `GetLegendGraphic`), so the UI links out to NASA Worldview's own
 * color scale instead of fabricating one.
 *
 * No server import here — the map renders the WMTS tiles directly in the
 * browser via react-leaflet's TileLayer, same as the OSM basemap.
 */

export const IMERG_TILE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate_30min/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png"

export const IMERG_WORLDVIEW_URL =
  "https://worldview.earthdata.nasa.gov/?v=-80,2,-72,8&l=IMERG_Precipitation_Rate_30min,Reference_Labels,Reference_Features,Coastlines"
