import "server-only"
import {
  areaCoordinates,
  FIRMS_SOURCES,
  REFERENCE_POINTS,
  type FirmsSource,
} from "./area"

const BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

export class FirmsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FirmsConfigError"
  }
}

export class FirmsRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FirmsRequestError"
  }
}

export type FireDetection = {
  id: string
  lat: number
  lon: number
  /** Acquisition timestamp in ISO form (UTC). */
  acquiredAt: string
  acqDate: string
  acqTime: string
  /** Fire Radiative Power in megawatts. */
  frp: number
  /** Brightness temperature channel I-4 (Kelvin). */
  brightness: number
  confidence: "low" | "nominal" | "high" | "unknown"
  daynight: "D" | "N" | "unknown"
  satellite: string
  source: FirmsSource
  /** Nearest reference municipality and distance in km. */
  nearest: { name: string; distanceKm: number }
}

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

function nearestPoint(lat: number, lon: number) {
  let best: { name: string; distanceKm: number } = {
    name: REFERENCE_POINTS[0].name,
    distanceKm: Infinity,
  }
  for (const p of REFERENCE_POINTS) {
    const d = haversineKm(lat, lon, p.lat, p.lon)
    if (d < best.distanceKm) best = { name: p.name, distanceKm: d }
  }
  return { name: best.name, distanceKm: Math.round(best.distanceKm * 10) / 10 }
}

function normalizeConfidence(raw: string): FireDetection["confidence"] {
  const v = raw.trim().toLowerCase()
  if (v === "h" || v === "high") return "high"
  if (v === "n" || v === "nominal") return "nominal"
  if (v === "l" || v === "low") return "low"
  return "unknown"
}

/** Parse a FIRMS CSV payload into typed detections. */
function parseCsv(csv: string, source: FirmsSource): FireDetection[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((h) => h.trim())
  const idx = (name: string) => header.indexOf(name)

  const iLat = idx("latitude")
  const iLon = idx("longitude")
  const iFrp = idx("frp")
  const iBright = idx("bright_ti4")
  const iConf = idx("confidence")
  const iDate = idx("acq_date")
  const iTime = idx("acq_time")
  const iSat = idx("satellite")
  const iDayNight = idx("daynight")

  const out: FireDetection[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",")
    if (cells.length < header.length) continue
    const lat = Number.parseFloat(cells[iLat])
    const lon = Number.parseFloat(cells[iLon])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const acqDate = cells[iDate]?.trim() ?? ""
    const acqTimeRaw = cells[iTime]?.trim() ?? "0"
    const padded = acqTimeRaw.padStart(4, "0")
    const hh = padded.slice(0, 2)
    const mm = padded.slice(2, 4)
    const acquiredAt = `${acqDate}T${hh}:${mm}:00Z`

    const dn = cells[iDayNight]?.trim().toUpperCase()

    out.push({
      id: `${source}-${lat.toFixed(5)}-${lon.toFixed(5)}-${acqDate}-${padded}`,
      lat,
      lon,
      acquiredAt,
      acqDate,
      acqTime: `${hh}:${mm}`,
      frp: iFrp >= 0 ? Number.parseFloat(cells[iFrp]) || 0 : 0,
      brightness: iBright >= 0 ? Number.parseFloat(cells[iBright]) || 0 : 0,
      confidence: iConf >= 0 ? normalizeConfidence(cells[iConf]) : "unknown",
      daynight: dn === "D" || dn === "N" ? dn : "unknown",
      satellite: iSat >= 0 ? cells[iSat]?.trim() || source : source,
      source,
      nearest: nearestPoint(lat, lon),
    })
  }
  return out
}

async function fetchSource(
  mapKey: string,
  source: FirmsSource,
  dayRange: number,
): Promise<FireDetection[]> {
  const url = `${BASE_URL}/${mapKey}/${source}/${areaCoordinates()}/${dayRange}`
  const res = await fetch(url, {
    // FIRMS NRT data updates a few times per day; cache briefly.
    next: { revalidate: 900 },
    headers: { Accept: "text/csv" },
  })
  const body = await res.text()

  // FIRMS returns HTTP 200 with a plain-text error for bad keys / limits.
  if (
    body.startsWith("Invalid") ||
    body.includes("Invalid MAP_KEY") ||
    body.includes("You have exceeded")
  ) {
    throw new FirmsRequestError(body.trim().slice(0, 200))
  }
  if (!res.ok) {
    throw new FirmsRequestError(`FIRMS ${source} responded ${res.status}`)
  }
  return parseCsv(body, source)
}

export type FireResult = {
  detections: FireDetection[]
  sourcesQueried: FirmsSource[]
  sourcesFailed: { source: FirmsSource; error: string }[]
  dayRange: number
}

/**
 * Query all configured VIIRS sources for the study area and merge them.
 * Deduplicates near-identical detections reported by overlapping platforms.
 */
export async function getAreaFires(dayRange = 2): Promise<FireResult> {
  const mapKey = process.env.FIRMS_MAP_KEY
  if (!mapKey) {
    throw new FirmsConfigError("FIRMS_MAP_KEY is not configured")
  }

  // FIRMS' area/csv endpoint rejects this map key's requests above 5 days
  // ("Invalid day range. Expects [1..5]."), even though other tiers allow up to 10.
  const range = Math.min(Math.max(Math.trunc(dayRange), 1), 5)

  const settled = await Promise.allSettled(
    FIRMS_SOURCES.map((s) => fetchSource(mapKey, s, range)),
  )

  const detections: FireDetection[] = []
  const sourcesFailed: { source: FirmsSource; error: string }[] = []
  settled.forEach((r, i) => {
    const source = FIRMS_SOURCES[i]
    if (r.status === "fulfilled") {
      detections.push(...r.value)
    } else {
      sourcesFailed.push({
        source,
        error:
          r.reason instanceof Error ? r.reason.message : "Error desconocido",
      })
    }
  })

  // If every source failed, surface the first error rather than an empty map.
  if (sourcesFailed.length === FIRMS_SOURCES.length) {
    throw new FirmsRequestError(sourcesFailed[0]?.error ?? "FIRMS no disponible")
  }

  const deduped = dedupe(detections)
  deduped.sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt))

  return {
    detections: deduped,
    sourcesQueried: [...FIRMS_SOURCES],
    sourcesFailed,
    dayRange: range,
  }
}

/** Collapse detections from different platforms that fall on the same ~400m cell and time. */
function dedupe(list: FireDetection[]): FireDetection[] {
  const seen = new Map<string, FireDetection>()
  for (const d of list) {
    const key = `${d.lat.toFixed(3)}-${d.lon.toFixed(3)}-${d.acqDate}-${d.daynight}`
    const existing = seen.get(key)
    // Keep the detection with the higher FRP as representative.
    if (!existing || d.frp > existing.frp) seen.set(key, d)
  }
  return [...seen.values()]
}
