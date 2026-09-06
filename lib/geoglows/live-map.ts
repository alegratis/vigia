/**
 * Client for GEOGLOWS' own live ArcGIS Living Atlas map service
 * (Esri "GlobalWaterModel_Medium" feed). This is the real, already-published
 * interactive layer GEOGLOWS operates — no auth, CORS-open, updated on their
 * forecast cycle — so the flood section renders it directly instead of
 * re-publishing a static local export for the same data.
 *
 * Docs: https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer
 */

import { LEVEL_STYLES } from "@/lib/flood-ui"

const MAP_SERVER =
  "https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer"

export interface LatLngBounds {
  north: number
  south: number
  east: number
  west: number
}

/**
 * Default area of interest: Sevilla / Caicedonia / Zarzal corridor, Valle del
 * Cauca. The southern edge extends to 3.88°N so Sevilla's full extent is
 * framed on load — its rural, mountainous south (down to ~3.90°N per the
 * landslide-susceptibility layer) was previously cropped out, leaving only
 * the municipality's northern edge visible.
 */
export const AOI_BOUNDS: LatLngBounds = {
  north: 4.62,
  south: 3.88,
  east: -75.72,
  west: -76.22,
}

export const AOI_CENTER: [number, number] = [4.25, -75.97]

/** Builds the export-image URL for the current viewport (lat/lon in, lat/lon out — no reprojection needed). */
export function buildExportUrl(bounds: LatLngBounds, width: number, height: number): string {
  const params = new URLSearchParams({
    bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${Math.max(1, Math.round(width))},${Math.max(1, Math.round(height))}`,
    format: "png32",
    transparent: "true",
    dpi: "96",
    layers: "show:0",
    f: "image",
  })
  return `${MAP_SERVER}/export?${params.toString()}`
}

function buildIdentifyUrl(
  lat: number,
  lon: number,
  bounds: LatLngBounds,
  width: number,
  height: number,
): string {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lon, y: lat }),
    geometryType: "esriGeometryPoint",
    sr: "4326",
    layers: "all",
    tolerance: "12",
    mapExtent: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    imageDisplay: `${Math.round(width)},${Math.round(height)},96`,
    returnGeometry: "false",
    f: "json",
  })
  return `${MAP_SERVER}/identify?${params.toString()}`
}

export interface ReachInfo {
  country: string
  meanFlowCms: number | null
  returnPeriod: number
  strahlerOrder: number | null
  forecastTimestamp: string | null
}

/** Reach attribute keys as returned by the identify operation (verified against the live service). */
interface IdentifyAttributes {
  "River Country Name"?: string
  "Mean Flow (m³/sec)"?: string
  "Return Period"?: string
  "Strahler Stream Order"?: string
  "Forecast Timestamp"?: string
}

function parseNumeric(value: string | undefined): number | null {
  if (!value || value === "Null") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Queries the reach nearest a map click and returns its forecast attributes, or null if none found. */
export async function identifyReach(
  lat: number,
  lon: number,
  bounds: LatLngBounds,
  width: number,
  height: number,
): Promise<ReachInfo | null> {
  const res = await fetch(buildIdentifyUrl(lat, lon, bounds, width, height))
  if (!res.ok) throw new Error("No se pudo consultar el servicio de GEOGLOWS")
  const json = await res.json()
  const result = json?.results?.[0]
  if (!result) return null

  const attrs = result.attributes as IdentifyAttributes
  return {
    country: attrs["River Country Name"] ?? "—",
    meanFlowCms: parseNumeric(attrs["Mean Flow (m³/sec)"]),
    returnPeriod: parseNumeric(attrs["Return Period"]) ?? 0,
    strahlerOrder: parseNumeric(attrs["Strahler Stream Order"]),
    forecastTimestamp: attrs["Forecast Timestamp"] ?? null,
  }
}

/**
 * The service renders 5 fixed return-period categories. Mapped onto our own
 * flood severity palette (lib/flood-ui.ts) so the live GEOGLOWS layer, the
 * station cards and the hydrographs all read as one consistent scale.
 */
export const RETURN_PERIOD_LEGEND: { value: number; label: string; color: string }[] = [
  { value: 0, label: "Normal", color: LEVEL_STYLES.normal.color },
  { value: 2, label: "Supera 2 años", color: LEVEL_STYLES.vigilancia.color },
  { value: 10, label: "Supera 10 años", color: LEVEL_STYLES.alerta.color },
  { value: 25, label: "Supera 25 años", color: LEVEL_STYLES.alerta_alta.color },
  { value: 50, label: "Supera 50 años", color: LEVEL_STYLES.emergencia.color },
]

export function returnPeriodLabel(returnPeriod: number): string {
  const match = [...RETURN_PERIOD_LEGEND].reverse().find((l) => returnPeriod >= l.value)
  return match?.label ?? "Normal"
}

export function returnPeriodColor(returnPeriod: number): string {
  const match = [...RETURN_PERIOD_LEGEND].reverse().find((l) => returnPeriod >= l.value)
  return match?.color ?? RETURN_PERIOD_LEGEND[0].color
}
