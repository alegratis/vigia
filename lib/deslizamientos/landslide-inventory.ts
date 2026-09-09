import "server-only"

/**
 * Client for the Colombian Geological Survey (SGC)'s national historical
 * mass-movement inventory ("Inventario de movimientos en masa" — SIMMA-
 * derived) — point records of past landslides, rockfalls, flows and
 * gravitational deformations, published as a public, no-auth ArcGIS
 * FeatureServer. Proximity to a documented past mass movement is direct
 * ground-truth evidence of local instability, not an indirect proxy like
 * slope or fault distance — which is why the hazard model gives it the
 * largest static-factor weight (see hazard-model.ts). Found via:
 * https://datos.sgc.gov.co/maps/accfa961f1d249c7a1efe2cc3d1ed326/about
 *
 * Only 55 points fall inside this app's AOI, and the layer carries no
 * reliable event date — so this is a sparse, non-exhaustive historical
 * record, not a live monitoring feed (see the caveat repeated in this
 * app's documentation).
 *
 * Service root: https://services1.arcgis.com/Og2nrTKe5bptW02d/arcgis/rest/services/Inventario_de_movimientos_en_masa/FeatureServer/0
 */

const FEATURE_SERVER_URL =
  "https://services1.arcgis.com/Og2nrTKe5bptW02d/arcgis/rest/services/Inventario_de_movimientos_en_masa/FeatureServer/0/query"

/** Same AOI the other hazard-model sources use, as an ArcGIS envelope: minLon,minLat,maxLon,maxLat. */
const AOI_ENVELOPE = "-76.06,3.88,-75.72,4.44"

export interface LandslideRecord {
  id: string
  lat: number
  lon: number
  /** Raw `TIPO` field, e.g. "Deslizamiento", "Caida", "Flujo". */
  tipo: string | null
  /** Raw `SUBTIPO` field, e.g. "Deslizamiento rotacional", "Caida de roca". */
  subtipo: string | null
}

interface RawFeature {
  attributes: { FID: number; TIPO?: string | null; SUBTIPO?: string | null }
  geometry?: { x?: number; y?: number }
}

/**
 * Fetches every historical mass-movement record intersecting the study-
 * area AOI. Cached for 30 days — same reasoning as faults.ts: this is a
 * static historical inventory, not a live feed, so it's safe to reuse
 * across both the hazard model's factor and the optional map layer
 * without re-fetching per request.
 */
export async function getLandslideRecords(): Promise<LandslideRecord[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "FID,TIPO,SUBTIPO",
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
    throw new Error("No se pudo consultar el inventario de movimientos en masa del SGC")
  }
  const json = (await res.json()) as { features?: RawFeature[] }
  const features = json.features ?? []

  const records: LandslideRecord[] = []
  for (const f of features) {
    const { x, y } = f.geometry ?? {}
    if (x == null || y == null) continue
    records.push({
      id: String(f.attributes.FID),
      lat: y,
      lon: x,
      tipo: f.attributes.TIPO ?? null,
      subtipo: f.attributes.SUBTIPO ?? null,
    })
  }
  return records
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
 * Nearest distance (km) from a point to any historical mass-movement
 * record — the fifth static-factor input in hazard-model.ts. Point-to-
 * point (unlike faults.ts's point-to-segment), since each record here is
 * an individual event location, not a continuous trace. `null` only if
 * the inventory itself failed to load, never a fabricated distance.
 */
export function nearestLandslideDistanceKm(
  lat: number,
  lon: number,
  records: readonly LandslideRecord[],
): number | null {
  if (records.length === 0) return null
  let min = Infinity
  for (const r of records) {
    min = Math.min(min, haversineKm(lat, lon, r.lat, r.lon))
  }
  return Number.isFinite(min) ? min : null
}
