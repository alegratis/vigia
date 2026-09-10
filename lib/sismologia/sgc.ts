import "server-only"

/**
 * Client for the Servicio Geológico Colombiano's public seismic catalog
 * ArcGIS FeatureServer — Colombia's official historical earthquake record,
 * confirmed queryable with no auth. Unlike USGS's live feed, this is a
 * positional/historical record that stops updating in near-real-time (see
 * lib/sismologia/exposure-score.ts for how this app frames the difference:
 * "USGS en vivo + SGC histórico" rather than treating either as a complete
 * live catalog on its own).
 */

import type { SeismicEvent } from "./api-types"
import type { Bbox } from "./usgs"

const SGC_QUERY_URL =
  "http://geoportal.sgc.gov.co/arcgis/rest/services/catalogo_sismos/catalogo_de_sismos_2/FeatureServer/0/query"

interface SgcFeature {
  attributes: {
    OBJECTID: number
    ESP_MAGNITUD: number | null
    ESP_FECHA_TXT: number | null // epoch ms
    ESP_LATITUD: number | null
    ESP_LONGITUD: number | null
    ESP_PROFUNDIDAD: number | null
  }
}

interface SgcResponse {
  features: SgcFeature[]
}

// Historical catalog changes essentially never — cache a full day.
const REVALIDATE_SECONDS = 86400

/**
 * Fetches every SGC-cataloged historical event within `bbox`. Returns an
 * empty, non-throwing list on failure so the map can still render the
 * USGS live layer on its own.
 */
export async function getSgcEvents(bbox: Bbox): Promise<SeismicEvent[]> {
  const where = `ESP_LATITUD BETWEEN ${bbox.south} AND ${bbox.north} AND ESP_LONGITUD BETWEEN ${bbox.west} AND ${bbox.east} AND ESP_MAGNITUD IS NOT NULL`
  const params = new URLSearchParams({
    where,
    outFields: "OBJECTID,ESP_MAGNITUD,ESP_FECHA_TXT,ESP_LATITUD,ESP_LONGITUD,ESP_PROFUNDIDAD",
    returnGeometry: "false",
    f: "json",
  })

  const res = await fetch(`${SGC_QUERY_URL}?${params.toString()}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) throw new Error(`SGC catalog query failed (${res.status})`)
  const data: SgcResponse = await res.json()

  return data.features
    .filter((f) => f.attributes.ESP_LATITUD != null && f.attributes.ESP_LONGITUD != null && f.attributes.ESP_MAGNITUD != null)
    .map((f) => ({
      id: `sgc-${f.attributes.OBJECTID}`,
      source: "sgc" as const,
      time: f.attributes.ESP_FECHA_TXT ? new Date(f.attributes.ESP_FECHA_TXT).toISOString() : new Date(0).toISOString(),
      magnitude: f.attributes.ESP_MAGNITUD as number,
      depthKm: f.attributes.ESP_PROFUNDIDAD,
      lat: f.attributes.ESP_LATITUD as number,
      lon: f.attributes.ESP_LONGITUD as number,
      place: null,
    }))
}
