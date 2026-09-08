import "server-only"

/**
 * Historical rainfall from IDEAM's real-time station network (datos.gov.co,
 * dataset `s54a-sgyg`, sensor 0240 = precipitación, reporting every ~10
 * min). Ground-truth readings, but sparse: only two stations fall near the
 * AOI and there are none inside Sevilla or Caicedonia, so most veredas have
 * no coverage under this source. Kept as an alternative to NASA POWER's
 * uniform-but-coarse 0.5° reanalysis grid (see power-client.ts), not a
 * replacement for it.
 */

const SOCRATA_BASE_URL = "https://www.datos.gov.co/resource/s54a-sgyg.json"
const REVALIDATE_SECONDS = 10800 // 3h, same cadence as power-client.ts.

/** Coverage radius (km): veredas farther than this from every station get no IDEAM value. */
const MAX_STATION_DISTANCE_KM = 20

export interface IdeamStation {
  code: string
  name: string
  lat: number
  lon: number
}

export const IDEAM_STATIONS: IdeamStation[] = [
  { code: "2633700150", name: "Guayabal (Zarzal)", lat: 4.405278889, lon: -76.100752778 },
  { code: "2636700098", name: "Hacienda La Graciosa (Bugalagrande)", lat: 4.2398, lon: -76.049247222 },
]

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function nearestStation(lat: number, lon: number): { station: IdeamStation; distanceKm: number } {
  let best = { station: IDEAM_STATIONS[0], distanceKm: Infinity }
  for (const station of IDEAM_STATIONS) {
    const d = haversineKm(lat, lon, station.lat, station.lon)
    if (d < best.distanceKm) best = { station, distanceKm: d }
  }
  return { station: best.station, distanceKm: Math.round(best.distanceKm * 10) / 10 }
}

interface StationAccumulation {
  accumulatedMm: number
  /** Number of 10-min readings summed — informational only, unlike POWER's daily validDays. */
  readingCount: number
}

async function fetchStationAccumulation(station: IdeamStation, windowDays: number): Promise<StationAccumulation | null> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
  const url =
    `${SOCRATA_BASE_URL}?$select=${encodeURIComponent("sum(valorobservado) as total, count(valorobservado) as n")}` +
    `&codigoestacion=${station.code}&$where=${encodeURIComponent(`fechaobservacion > '${since}'`)}`

  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!res.ok) return null

  const rows = (await res.json()) as Array<{ total?: string; n?: string }>
  const row = rows[0]
  const total = row?.total != null ? Number.parseFloat(row.total) : null
  const n = row?.n != null ? Number.parseInt(row.n, 10) : 0
  if (total == null || !Number.isFinite(total) || n === 0) return null

  return { accumulatedMm: total, readingCount: n }
}

export interface IdeamAccumulation {
  accumulatedMm: number
  /** Mirrors PrecipitationAccumulation's shape so server.ts can treat both sources uniformly. */
  validDays: number
  estacionNombre: string
  distanciaEstacionKm: number
}

/**
 * Fetches each configured station's accumulation once (not once per
 * vereda), then assigns every centroid the nearest station's value if it's
 * within MAX_STATION_DISTANCE_KM — otherwise `null`, meaning "no IDEAM
 * coverage here" rather than "fetch failed".
 */
export async function getIdeamAccumulationBatch(
  points: Array<{ lon: number; lat: number }>,
  windowDays: number,
): Promise<Array<IdeamAccumulation | null>> {
  const stationResults = await Promise.all(
    IDEAM_STATIONS.map((station) => fetchStationAccumulation(station, windowDays)),
  )
  const byStationCode = new Map(IDEAM_STATIONS.map((s, i) => [s.code, stationResults[i]]))

  return points.map((p) => {
    const { station, distanceKm } = nearestStation(p.lat, p.lon)
    if (distanceKm > MAX_STATION_DISTANCE_KM) return null
    const acc = byStationCode.get(station.code)
    if (!acc) return null
    return {
      accumulatedMm: acc.accumulatedMm,
      validDays: windowDays,
      estacionNombre: station.name,
      distanciaEstacionKm: distanceKm,
    }
  })
}
