import "server-only"

/**
 * Server-only client for "Sitios críticos" — the Valle del Cauca
 * infrastructure secretariat's field-surveyed road-damage points (layer
 * index 1, identical schema across all three municipalities in the study
 * area). Open, CORS-enabled ArcGIS Server, no auth needed:
 * https://infraestructura.valledelcauca.gov.co/server/rest/services/{municipio}/MapServer/1
 *
 * Only 57 (Sevilla) + 36 (Caicedonia) + 1 (Zarzal) = 94 records total, so
 * every point is fetched in one request per municipality with no paging —
 * unlike the ~11,721-point `VIGIA_Amenaza_IS_Puntos` susceptibility layer.
 * The whole dataset is a single 2019-07-15 field survey, not a live feed:
 * treat it as "known historical trouble spots," not current monitoring.
 */

import type { CriticalSitePoint } from "./critical-sites-types"

const SERVICE_ROOT = "https://infraestructura.valledelcauca.gov.co/server/rest/services"
const MUNICIPIOS = ["Sevilla", "Caicedonia", "Zarzal"] as const

interface RawFeature {
  attributes: {
    OBJECTID: number
    CODIGOVIA: string | null
    FECHA: string | null
    TIPO: number | null
    SEVERIDAD: number | null
    OBS: string | null
  }
  geometry?: { x: number; y: number }
}

async function fetchMunicipioSites(municipio: string): Promise<CriticalSitePoint[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "OBJECTID,CODIGOVIA,FECHA,TIPO,SEVERIDAD,OBS",
    outSR: "4326",
    resultRecordCount: "500",
    f: "json",
  })
  const res = await fetch(`${SERVICE_ROOT}/${municipio}/MapServer/1/query?${params.toString()}`, {
    next: { revalidate: 86400 },
  })
  if (!res.ok) {
    throw new Error(`No se pudo consultar los sitios críticos de ${municipio}`)
  }
  const json = (await res.json()) as { features?: RawFeature[] }
  const features = json.features ?? []

  const points: CriticalSitePoint[] = []
  for (const f of features) {
    const { attributes: a, geometry: g } = f
    if (!g || typeof g.x !== "number" || typeof g.y !== "number") continue
    if (typeof a.TIPO !== "number" || typeof a.SEVERIDAD !== "number") continue
    points.push({
      id: `${municipio}-${a.OBJECTID}`,
      lat: g.y,
      lon: g.x,
      municipio,
      tipo: a.TIPO,
      severidad: a.SEVERIDAD,
      fecha: a.FECHA ?? null,
      observaciones: a.OBS ?? null,
      codigoVia: a.CODIGOVIA ?? null,
    })
  }
  return points
}

/**
 * Fetches every "sitio crítico" across Sevilla, Caicedonia and Zarzal in
 * parallel and merges them into one flat list, ready to render as map
 * markers or a table.
 */
export async function getCriticalSites(): Promise<CriticalSitePoint[]> {
  const results = await Promise.all(MUNICIPIOS.map((m) => fetchMunicipioSites(m)))
  return results.flat()
}
