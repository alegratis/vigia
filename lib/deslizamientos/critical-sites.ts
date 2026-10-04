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
 *
 * This government ArcGIS server resets the TLS connection under load far
 * more often than the other open sources this app depends on (observed as
 * `ECONNRESET` / "socket disconnected before secure TLS connection was
 * established"). Each municipality fetch gets its own timeout + one retry,
 * and a municipality that still fails after that degrades to an empty list
 * instead of throwing — so one flaky upstream government endpoint can't
 * take down `/api/veredas` (and every vereda-dependent map) for the whole
 * study area, it just quietly omits that municipality's points.
 */

import type { CriticalSitePoint } from "./critical-sites-types"

const SERVICE_ROOT = "https://infraestructura.valledelcauca.gov.co/server/rest/services"
const MUNICIPIOS = ["Sevilla", "Caicedonia", "Zarzal"] as const

/** Per-attempt timeout: a stalled/reset TLS handshake shouldn't hang the request indefinitely. */
const REQUEST_TIMEOUT_MS = 8000
const MAX_ATTEMPTS = 2

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

async function queryMunicipioOnce(municipio: string): Promise<CriticalSitePoint[]> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "OBJECTID,CODIGOVIA,FECHA,TIPO,SEVERIDAD,OBS",
    outSR: "4326",
    resultRecordCount: "500",
    f: "json",
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${SERVICE_ROOT}/${municipio}/MapServer/1/query?${params.toString()}`, {
      next: { revalidate: 86400 },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    throw new Error(`No se pudo consultar los sitios críticos de ${municipio} (status ${res.status})`)
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
 * Retries a single municipality's query up to `MAX_ATTEMPTS` times before
 * giving up and degrading to an empty list — this upstream server's TLS
 * resets are transient, so a second attempt frequently succeeds where the
 * first one got reset.
 */
async function fetchMunicipioSites(municipio: string): Promise<CriticalSitePoint[]> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await queryMunicipioOnce(municipio)
    } catch (err) {
      lastError = err
    }
  }
  console.error(
    `[sitios-criticos] Omitiendo ${municipio} tras ${MAX_ATTEMPTS} intentos fallidos:`,
    lastError instanceof Error ? lastError.message : lastError,
  )
  return []
}

/**
 * Fetches every "sitio crítico" across Sevilla, Caicedonia and Zarzal in
 * parallel and merges them into one flat list, ready to render as map
 * markers or a table. Never rejects — a municipality whose server keeps
 * resetting the connection just contributes an empty list instead of
 * failing every caller (including `/api/veredas`, which bundles this with
 * unrelated vereda aggregates for other hazard categories).
 */
export async function getCriticalSites(): Promise<CriticalSitePoint[]> {
  const results = await Promise.all(MUNICIPIOS.map((m) => fetchMunicipioSites(m)))
  return results.flat()
}
