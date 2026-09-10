import "server-only"

/**
 * Joins the `AmenazaIncendios` fire-threat polygons (lib/incendios/client.ts
 * — per-vereda polygons, but keyed by name rather than `codigoVereda`) onto
 * each vereda's centroid via point-in-polygon, the same technique already
 * used for the official flood-zoning join in
 * lib/inundaciones/hazard-model.ts. A new file rather than a change to
 * incendios/client.ts, so the existing incendios map/model — which reads
 * that layer directly by name/geometry, not by this join — is untouched.
 *
 * Centroid join rather than name matching: `NOMBRE_VER` on this layer is
 * raw, occasionally-misspelled text from a different publisher than the
 * vereda boundaries this app already fetches (see
 * lib/veredas/boundaries.ts) — a geometric test is more robust than
 * comparing two independently-sourced name strings.
 */

import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon"
import { getFireThreatPolygons } from "@/lib/incendios/client"
import { isFireThreatLevel, type FireThreatLevel } from "@/lib/incendios/levels"

function isPolygonal(geometry: GeoJSON.Geometry): geometry is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon"
}

export interface FireCentroid {
  codigoVereda: string
  lat: number
  lon: number
}

/**
 * Resolves the fire-threat level at each vereda centroid. Returns a Map
 * keyed by `codigoVereda`, with `null` for any vereda whose centroid falls
 * outside every fire-threat polygon (this layer only covers Sevilla and
 * Caicedonia — Zarzal always resolves to `null` here, the same "no data"
 * convention used everywhere else in this app).
 */
export async function joinFireThreatToVeredas(
  centroids: FireCentroid[],
): Promise<Map<string, FireThreatLevel | null>> {
  const result = new Map<string, FireThreatLevel | null>()
  if (centroids.length === 0) return result

  let polygons: Awaited<ReturnType<typeof getFireThreatPolygons>> | null = null
  try {
    polygons = await getFireThreatPolygons()
  } catch {
    polygons = null
  }

  const zonedFeatures = (polygons?.features ?? []).filter((f) => isPolygonal(f.geometry))

  for (const c of centroids) {
    let level: FireThreatLevel | null = null
    for (const feature of zonedFeatures) {
      if (booleanPointInPolygon([c.lon, c.lat], feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon)) {
        const label = feature.properties.Amenaza_Label
        if (label && isFireThreatLevel(label)) level = label
        break
      }
    }
    result.set(c.codigoVereda, level)
  }

  return result
}
