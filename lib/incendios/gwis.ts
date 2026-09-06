/**
 * Configuration for GWIS (Global Wildfire Information System) / Copernicus
 * EFFIS's public Fire Weather Index (FWI) forecast — an open, CORS-enabled
 * WMS run by the EU Joint Research Centre. No API key needed; the same kind
 * of publicly hosted service GEOGLOWS and the ArcGIS threat layers use.
 *
 * Layer `ecmwf.fwi`: daily FWI forecast derived from ECMWF weather data. The
 * server snaps an arbitrary `TIME` to the nearest date it actually has, so
 * requesting a few days out is safe even if the forecast horizon shifts.
 *
 * No server import here — the map renders the WMS tiles directly in the
 * browser via react-leaflet's WMSTileLayer, same as any other basemap tile.
 */

export const GWIS_WMS_URL = "https://maps.effis.emergency.copernicus.eu/gwis"
export const GWIS_FWI_LAYER = "ecmwf.fwi"

export const GWIS_LEGEND_URL =
  `${GWIS_WMS_URL}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetLegendGraphic&LAYER=${GWIS_FWI_LAYER}&FORMAT=image/png`

export interface ForecastDayOption {
  /** ISO date (YYYY-MM-DD), sent as the WMS TIME parameter. */
  value: string
  label: string
}

/** "Hoy", "Mañana" and "+N días" options for the FWI forecast day picker. */
export function forecastDayOptions(referenceDate: Date = new Date()): ForecastDayOption[] {
  const days = 7
  const options: ForecastDayOption[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(referenceDate)
    d.setUTCDate(d.getUTCDate() + i)
    const value = d.toISOString().slice(0, 10)
    const label = i === 0 ? "Hoy" : i === 1 ? "Mañana" : `+${i} días`
    options.push({ value, label })
  }
  return options
}
