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

import { normalizeVeredaNombre } from "@/lib/veredas/name-corrections"
import type { FireThreatFeatureCollection } from "./api-types"

const SERVICE_ROOT = "https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services"
const FIRE_THREAT_LAYER = `${SERVICE_ROOT}/AmenazaIncendios/FeatureServer/0`

/**
 * Fetches the forest-fire threat polygons (by vereda) as ready-to-render
 * GeoJSON in WGS84. `NOMBRE_VER` comes back raw from this ArcGIS layer (no
 * title-casing, occasional misspellings like "COMINGALES"), so it's run
 * through the same correction used for the RED LabOT veredas layer
 * (lib/veredas/boundaries.ts) — both this layer's own popup and any name
 * matching against that other, independently-sourced vereda list need the
 * corrected spelling ("Cominales") to agree.
 */
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
  const data: FireThreatFeatureCollection = await res.json()
  return {
    ...data,
    features: data.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        NOMBRE_VER: feature.properties.NOMBRE_VER
          ? normalizeVeredaNombre(feature.properties.NOMBRE_VER)
          : feature.properties.NOMBRE_VER,
      },
    })),
  }
}
