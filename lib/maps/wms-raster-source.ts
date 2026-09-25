import type { RasterSourceSpecification } from "maplibre-gl"

/**
 * Builds a MapLibre raster `Source` spec for a WMS layer, using the
 * `{bbox-epsg-3857}` token MapLibre/Mapbox raster sources support natively
 * for WMS `BBOX` params (in place of the {z}/{x}/{y} template a plain XYZ
 * tile source uses). Mirrors the WMS URLs already used by the Leaflet
 * `WMSTileLayer`s for the same GWIS layers (land cover, settlement,
 * protected areas) — just reshaped into a `tiles` template.
 *
 * `wmsBaseUrl` is the bare WMS endpoint (e.g. GWIS_WMS_URL); `layer` is the
 * WMS `LAYERS` value. `extraParams` can carry a `TIME` value or similar
 * per-layer query params.
 */
export function wmsRasterSource(
  wmsBaseUrl: string,
  layer: string,
  extraParams: Record<string, string> = {},
  tileSize = 256,
): RasterSourceSpecification {
  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layer,
    STYLES: "",
    FORMAT: "image/png",
    TRANSPARENT: "true",
    SRS: "EPSG:3857",
    WIDTH: String(tileSize),
    HEIGHT: String(tileSize),
    ...extraParams,
  })

  return {
    type: "raster",
    tiles: [`${wmsBaseUrl}?${params.toString()}&BBOX={bbox-epsg-3857}`],
    tileSize,
  }
}
