import "server-only"

/**
 * Client for IDEAM's public monthly precipitation *climatology* (long-run
 * "normal" rainfall per month, not a live reading) — a different IDEAM
 * product from lib/precipitacion/ideam-client.ts, which queries the live
 * automatic-station network. This one queries IDEAM's public interpolated
 * raster of historical normals, published as vector polygons on their
 * ArcGIS Server (visualizador.ideam.gov.co), for two published periods:
 *
 * - Layer 62 — "Normal Climatológica Estándar Precipitación Total Mensual
 *   91-20" (1991-2020 normal)
 * - Layer 52 — "Precipitación Media Total Mensual Promedio Multianual
 *   Periodo 1981-2010" (1981-2010 normal)
 *
 * Both are isohyet-style interpolations covering all of Colombia, so
 * (unlike ideam-client.ts's 2 real stations near Zarzal/Bugalagrande) they
 * resolve for every vereda centroid in the study area. The tradeoff:
 * querying a point returns a precipitation **range** per month (e.g.
 * "150 - 200 mm"), not an exact figure — this module reports the band's
 * midpoint as an estimate, alongside the original range, rather than
 * fabricating false precision.
 */

const CLIMA_PRECIPITACION_BASE = "https://visualizador.ideam.gov.co/gisserver/rest/services/Clima_Precipitacion/MapServer"

const LAYER_1991_2020 = { id: 62, rangeField: "rangos", dateField: "periodoini" }
const LAYER_1981_2010 = { id: 52, rangeField: "rango", dateField: "per_ini" }

export const MONTH_LABELS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

// This is a static historical-normals raster, not a forecast or live reading — safe to cache for a long time.
const REVALIDATE_SECONDS = 2592000 // 30 days

interface RangeEstimate {
  /** Midpoint of the published range (or the lower bound scaled up 15% for the open-ended "> N mm" band), rounded to the nearest mm. */
  mm: number
  /** The original published range/band, e.g. "150 - 200 mm". */
  label: string
}

/** Parses IDEAM's "150 - 200" / "150 - 200 mm" / "> 1000 mm" range strings into a midpoint estimate. */
function parseRange(raw: string | null | undefined): RangeEstimate | null {
  if (!raw) return null
  const trimmed = raw.trim()

  const between = trimmed.match(/^([\d.]+)\s*-\s*([\d.]+)/)
  if (between) {
    const lo = Number(between[1])
    const hi = Number(between[2])
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      return { mm: Math.round((lo + hi) / 2), label: `${lo} - ${hi} mm` }
    }
  }

  const openEnded = trimmed.match(/^>\s*([\d.]+)/)
  if (openEnded) {
    const lo = Number(openEnded[1])
    if (Number.isFinite(lo)) {
      return { mm: Math.round(lo * 1.15), label: `> ${lo} mm` }
    }
  }

  return null
}

async function queryMonthlyRanges(
  layer: { id: number; rangeField: string; dateField: string },
  lon: number,
  lat: number,
): Promise<Map<number, RangeEstimate>> {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: `${layer.rangeField},${layer.dateField}`,
    returnGeometry: "false",
    f: "json",
  })

  const res = await fetch(`${CLIMA_PRECIPITACION_BASE}/${layer.id}/query?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) throw new Error(`IDEAM climatología query failed (${res.status})`)
  const data = await res.json()
  if (data.error) throw new Error(`IDEAM climatología query error: ${data.error.message ?? JSON.stringify(data.error)}`)

  const byMonth = new Map<number, RangeEstimate>()
  for (const feature of data.features ?? []) {
    const attrs = feature.attributes as Record<string, unknown>
    const dateMs = attrs[layer.dateField] as number | null
    if (dateMs == null) continue
    const month = new Date(dateMs).getUTCMonth() + 1
    const estimate = parseRange(attrs[layer.rangeField] as string | undefined)
    if (estimate) byMonth.set(month, estimate)
  }
  return byMonth
}

export interface MonthlyClimatologyPoint {
  month: number
  monthLabel: string
  mm1991_2020: number | null
  rango1991_2020: string | null
  mm1981_2010: number | null
  rango1981_2010: string | null
}

/**
 * Fetches both published monthly-normal periods for one point and merges
 * them into a 12-month series. Either period can be `null` for a given
 * month if IDEAM's raster has no polygon at that exact point (rare, but
 * possible right at a boundary) — never a fabricated value.
 */
export async function getMonthlyClimatology(lon: number, lat: number): Promise<MonthlyClimatologyPoint[]> {
  const [normals1991_2020, normals1981_2010] = await Promise.all([
    queryMonthlyRanges(LAYER_1991_2020, lon, lat),
    queryMonthlyRanges(LAYER_1981_2010, lon, lat),
  ])

  return MONTH_LABELS_ES.map((monthLabel, i) => {
    const month = i + 1
    const a = normals1991_2020.get(month) ?? null
    const b = normals1981_2010.get(month) ?? null
    return {
      month,
      monthLabel,
      mm1991_2020: a?.mm ?? null,
      rango1991_2020: a?.label ?? null,
      mm1981_2010: b?.mm ?? null,
      rango1981_2010: b?.label ?? null,
    }
  })
}
