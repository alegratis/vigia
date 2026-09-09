import "server-only"

/**
 * Client for the Colombian Geological Survey (SGC)'s national geological
 * faults layer — fault traces (type + name) from the Atlas Geológico de
 * Colombia, published as a public, no-auth ArcGIS FeatureServer. Fault
 * proximity is one of NASA LHASA v1's five static susceptibility
 * predictors (Stanley & Kirschbaum, 2017); this app's hazard model
 * previously dropped it (see hazard-model.ts's header comment, before this
 * factor was added) because geology layers are usually only published as
 * raw raster files with no point-query API. This dataset is the
 * exception — a small, directly queryable vector layer — found via:
 * https://datos.sgc.gov.co/datasets/e03339c845d24e7baceb6d67397a23b3_0
 *
 * Service root: https://services1.arcgis.com/Og2nrTKe5bptW02d/arcgis/rest/services/Fallas/FeatureServer/0
 */

const FEATURE_SERVER_URL =
  "https://services1.arcgis.com/Og2nrTKe5bptW02d/arcgis/rest/services/Fallas/FeatureServer/0/query"

/** Same AOI the other hazard-model sources use, as an ArcGIS envelope: minLon,minLat,maxLon,maxLat. */
const AOI_ENVELOPE = "-76.06,3.88,-75.72,4.44"

export interface FaultTrace {
  id: string
  /** Raw `Tipo` field, e.g. "Falla" (fault) or "Falla inferida" (inferred fault). */
  tipo: string | null
  /** Raw `NombreFall` field, e.g. "Falla de Cauca-Almaguer". */
  nombre: string | null
  /** One or more disjoint polylines (esri JSON "paths"), each a `[lon, lat]` vertex list. */
  paths: Array<Array<[number, number]>>
}

interface RawFeature {
  attributes: { OBJECTID: number; Tipo?: string | null; NombreFall?: string | null }
  geometry?: { paths?: Array<Array<[number, number]>> }
}

/**
 * Fetches every fault trace intersecting the study-area AOI. Cached for 30
 * days — geological fault mapping is static on any timescale this app
 * cares about, unlike every other rainfall/road/soil-moisture source it
 * fetches, which is the whole reason it's safe to reuse across both the
 * hazard model's fault-proximity factor and the optional map layer without
 * re-fetching per request.
 */
export async function getFaultTraces(): Promise<FaultTrace[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "OBJECTID,Tipo,NombreFall",
    geometry: AOI_ENVELOPE,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outSR: "4326",
    f: "json",
  })
  const res = await fetch(`${FEATURE_SERVER_URL}?${params.toString()}`, {
    next: { revalidate: 2592000 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la capa de fallas geológicas del SGC")
  }
  const json = (await res.json()) as { features?: RawFeature[] }
  const features = json.features ?? []

  const traces: FaultTrace[] = []
  for (const f of features) {
    const paths = f.geometry?.paths
    if (!paths || paths.length === 0) continue
    traces.push({
      id: String(f.attributes.OBJECTID),
      tipo: f.attributes.Tipo ?? null,
      nombre: f.attributes.NombreFall ?? null,
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
 * projection around the query point's own latitude — accurate enough at
 * this AOI's ~50 km scale without a full geodesic-projection dependency.
 * Unlike road-proximity.ts's nearest-*vertex* approximation (fine there
 * because OSM road ways carry vertices tens of meters apart), fault
 * traces here have far sparser vertices over much longer lines — nearest-
 * vertex would materially overstate distance to a trace that actually
 * passes close to a point between two of its vertices.
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
 * Nearest distance (km) from a point to any segment of any fault trace —
 * the fourth static-factor input in hazard-model.ts. `null` only if the
 * fault layer itself failed to load, never a fabricated distance.
 */
export function nearestFaultDistanceKm(
  lat: number,
  lon: number,
  traces: readonly FaultTrace[],
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
