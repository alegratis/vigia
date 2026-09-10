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
 * GIBS doesn't publish a machine-readable `GetLegendGraphic` for this WMTS
 * layer (unlike GWIS), but it does publish the underlying colormap as XML
 * (https://gibs.earthdata.nasa.gov/colormaps/v1.3/SMAP_Analyzed_Soil_Moisture.xml)
 * — the exact ramp used both to render this layer's tiles and to draw NASA
 * Worldview's own legend bar. `SMAP_COLOR_STOPS` below are that XML's own
 * `showTick` breakpoints (the same points Worldview itself labels), so this
 * app's in-map legend reproduces that ramp instead of just linking out to it.
 *
 * No server import here — the map renders the WMTS tiles directly in the
 * browser via react-leaflet's TileLayer, same as the OSM basemap.
 */

export const SMAP_TILE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L4_Analyzed_Root_Zone_Soil_Moisture/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png"

/**
 * Root-zone soil moisture (m³/m³), 0 (dry) to ≥0.7 (saturated). Colors are
 * literal GIBS colormap RGB values, not design tokens — this scientific
 * ramp is fixed by NASA's own published colormap, independent of the app's
 * light/dark theme.
 */
export const SMAP_COLOR_STOPS: { value: number; rgb: string }[] = [
  { value: 0.0, rgb: "rgb(255,162,0)" },
  { value: 0.085, rgb: "rgb(255,236,0)" },
  { value: 0.174, rgb: "rgb(130,193,0)" },
  { value: 0.262, rgb: "rgb(0,158,62)" },
  { value: 0.347, rgb: "rgb(0,254,255)" },
  { value: 0.435, rgb: "rgb(0,77,255)" },
  { value: 0.524, rgb: "rgb(0,0,187)" },
  { value: 0.612, rgb: "rgb(16,16,100)" },
  { value: 0.7, rgb: "rgb(80,80,80)" },
]

export const SMAP_MAX_VALUE = 0.7
