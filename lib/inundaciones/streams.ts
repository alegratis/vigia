import "server-only"

/**
 * Client for the stream/creek network layer ("Quebradas") published on the
 * same ArcGIS Online org as the flood-susceptibility zoning layer (see
 * lib/inundaciones/client.ts) — 19 named stream/river polylines
 * (`NOMBRE_GEOGRAFICO`) covering the full study area AOI, including
 * Zarzal, which the zoning layer never covered. Open, CORS-enabled
 * FeatureServer — no auth needed.
 *
 * Proximity to a stream is the primary geomorphological driver of flood
 * extent (this app's flood hazard model's largest-reach factor — see
 * hazard-model.ts), and, unlike the zoning layer, it's available
 * everywhere in the AOI.
 *
 * Each trace also carries a `rivid` field, and its numbering scheme
 * matches the reach IDs GEOGLOWS already uses elsewhere in this app (see
 * lib/geoglows/*) for live river-forecast lookups. That's a real future
 * extension hook — e.g. weighting a vereda's flood score by its nearest
 * reach's live return-period exceedance — but it's *not* wired up here:
 * unlike every other factor in this model, which is a single cheap
 * batched/cached fetch, pulling a live GEOGLOWS forecast per vereda
 * centroid would mean dozens of individual per-reach network calls on
 * every request. Left as a noted, not-yet-implemented hook.
 *
 * Docs: https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/Quebradas/FeatureServer
 */

const SERVICE_ROOT = "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services"
const STREAMS_LAYER = `${SERVICE_ROOT}/Quebradas/FeatureServer/0/query`

export interface StreamTrace {
  id: string
  /** Raw `NOMBRE_GEOGRAFICO` field, e.g. "Río Palomino", "Quebrada Morelia". */
  nombre: string | null
  /** GEOGLOWS reach ID — see the module doc above. Not used by the hazard model yet. */
  rivid: number | null
  /** One or more disjoint polylines (esri JSON "paths"), each a `[lon, lat]` vertex list. */
  paths: Array<Array<[number, number]>>
}

interface RawFeature {
  attributes: { OBJECTID: number; NOMBRE_GEOGRAFICO?: string | null; rivid?: number | null }
  geometry?: { paths?: Array<Array<[number, number]>> }
}

/**
 * Fetches every stream/creek trace published in this layer — it's not
 * restricted to an AOI envelope like the other point-query sources in this
 * app (faults.ts, landslide-inventory.ts), since the whole layer is only
 * 19 features and already scoped to the study area by its publisher.
 * Cached for 30 days — stream courses are static hydrography, same
 * reasoning as faults.ts, so it's safe to reuse across both the hazard
 * model's stream-proximity factor and a future map layer without
 * re-fetching per request.
 */
export async function getStreamTraces(): Promise<StreamTrace[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "OBJECTID,NOMBRE_GEOGRAFICO,rivid",
    outSR: "4326",
    f: "json",
  })
  const res = await fetch(`${STREAMS_LAYER}?${params.toString()}`, {
    next: { revalidate: 2592000 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la capa de quebradas y ríos")
  }
  const json = (await res.json()) as { features?: RawFeature[] }
  const features = json.features ?? []

  const traces: StreamTrace[] = []
  for (const f of features) {
    const paths = f.geometry?.paths
    if (!paths || paths.length === 0) continue
    traces.push({
      id: String(f.attributes.OBJECTID),
      nombre: f.attributes.NOMBRE_GEOGRAFICO ?? null,
      rivid: f.attributes.rivid ?? null,
      paths,
    })
  }
  return traces
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * True point-to-segment distance (km), via a local equirectangular
 * projection around the query point's own latitude — same approach and
 * same reasoning as faults.ts's `pointToSegmentKm`: stream traces have
 * sparse vertices over long lines, so nearest-vertex would materially
 * overstate distance to a trace that actually passes close to a point
 * between two of its vertices.
 */
function pointToSegmentKm(
  lat: number,
  lon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const kmPerDegLat = 111.32
  const kmPerDegLon = 111.32 * Math.cos((lat * Math.PI) / 180)
  const px = lon * kmPerDegLon
  const py = lat * kmPerDegLat
  const ax = aLon * kmPerDegLon
  const ay = aLat * kmPerDegLat
  const bx = bLon * kmPerDegLon
  const by = bLat * kmPerDegLat

  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * Nearest distance (km) from a point to any segment of any stream trace —
 * the flood hazard model's stream-proximity factor input. `null` only if
 * the stream layer itself failed to load, never a fabricated distance.
 */
export function nearestStreamDistanceKm(
  lat: number,
  lon: number,
  traces: readonly StreamTrace[],
): number | null {
  if (traces.length === 0) return null
  let min = Infinity
  for (const trace of traces) {
    for (const path of trace.paths) {
      if (path.length === 1) {
        const [aLon, aLat] = path[0]
        min = Math.min(min, haversineKm(lat, lon, aLat, aLon))
        continue
      }
      for (let i = 0; i < path.length - 1; i++) {
        const [aLon, aLat] = path[i]
        const [bLon, bLat] = path[i + 1]
        min = Math.min(min, pointToSegmentKm(lat, lon, aLat, aLon, bLat, bLon))
      }
    }
  }
  return Number.isFinite(min) ? min : null
}
