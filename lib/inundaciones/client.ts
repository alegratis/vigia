import "server-only"

/**
 * Client for the public flood-susceptibility layer published on ArcGIS
 * Online (`susceptibilidad_inundaciones`, covering Sevilla and Caicedonia —
 * the same publishing org and pattern as the landslide and fire threat
 * layers, see lib/deslizamientos/client.ts and lib/incendios/client.ts).
 * This is a static hazard zoning, complementary to GEOGLOWS' live river
 * forecast already on this page. Open, CORS-enabled FeatureServer — no auth
 * needed.
 *
 * Docs: https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/susceptibilidad_inundaciones/FeatureServer
 */

import type { FloodSusceptibilityFeatureCollection } from "./api-types"

const SERVICE_ROOT = "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services"
const FLOOD_SUSCEPTIBILITY_LAYER = `${SERVICE_ROOT}/susceptibilidad_inundaciones/FeatureServer/0`

/** Fetches the flood-susceptibility polygons as ready-to-render GeoJSON in WGS84. */
export async function getFloodSusceptibilityPolygons(): Promise<FloodSusceptibilityFeatureCollection> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "descripcio",
    outSR: "4326",
    geometryPrecision: "5",
    f: "geojson",
  })
  const res = await fetch(`${FLOOD_SUSCEPTIBILITY_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la capa de susceptibilidad a inundaciones")
  }
  return res.json()
}
