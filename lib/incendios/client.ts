import "server-only"

/**
 * Client for the public forest-fire threat layer published on ArcGIS Online
 * (`AmenazaIncendios`, covering rural veredas of Sevilla and Caicedonia — the
 * same publishing org and pattern as the landslide susceptibility layer, see
 * lib/deslizamientos/client.ts). Open, CORS-enabled FeatureServer — no auth
 * needed.
 *
 * Docs: https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services/AmenazaIncendios/FeatureServer
 */

import type { FireThreatFeatureCollection } from "./api-types"

const SERVICE_ROOT = "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services"
const FIRE_THREAT_LAYER = `${SERVICE_ROOT}/AmenazaIncendios/FeatureServer/0`

/** Fetches the forest-fire threat polygons (by vereda) as ready-to-render GeoJSON in WGS84. */
export async function getFireThreatPolygons(): Promise<FireThreatFeatureCollection> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "NOMB_MPIO,NOMBRE_VER,Amenaza_Label",
    outSR: "4326",
    geometryPrecision: "5",
    f: "geojson",
  })
  const res = await fetch(`${FIRE_THREAT_LAYER}/query?${params.toString()}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    throw new Error("No se pudo consultar la capa de amenaza por incendios forestales")
  }
  return res.json()
}
