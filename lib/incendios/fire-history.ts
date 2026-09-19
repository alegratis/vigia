import "server-only"

/**
 * Historical fire recurrence — the strongest static-factor input to the
 * self-computed forest-fire hazard model (see hazard-model.ts): direct
 * ground-truth evidence of where fires have actually burned before, the
 * same "direct evidence outweighs an indirect proxy" role the SGC mass-
 * movement inventory plays as the highest-weighted static factor in the
 * landslide hazard model (see lib/deslizamientos/hazard-model.ts).
 *
 * NASA FIRMS' `area/csv` endpoint (already used for the map's live "Focos
 * activos" layer, see lib/firms/client.ts) caps every request at 5 days
 * for this map key, so a multi-month recurrence window means paging
 * backward through consecutive 5-day windows via the endpoint's optional
 * trailing `DATE` path segment (the end date of each window), rather than
 * one request for the whole window. Uses VIIRS_SNPP_NRT only — the
 * finest-resolution source (375 m) — rather than every FIRMS source the
 * live map offers, since this is a density estimate, not a full
 * detection feed, and one sensor keeps the request count for a ~5-month
 * lookback manageable.
 */

import { areaCoordinates } from "@/lib/firms/area"

const BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
const RECURRENCE_SOURCE = "VIIRS_SNPP_NRT"
/** FIRMS area/csv day-range cap for this app's map key. */
const CHUNK_DAYS = 5
/** How far back the recurrence window reaches — long enough to catch a full local dry season, short enough to keep the chunked request count reasonable. */
const LOOKBACK_DAYS = 150
/** How many chunk requests run at once — polite to FIRMS' rate limits, still fast enough for a ~30-chunk window. */
const CONCURRENCY = 5
// A past window's detections never change once published; cache generously.
const REVALIDATE_SECONDS = 21_600 // 6 hours

export interface HistoricalFirePoint {
  lat: number
  lon: number
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Minimal CSV parse — only the two columns this factor needs, unlike lib/firms/client.ts's full FireDetection parser. */
function parseLatLon(csv: string): HistoricalFirePoint[] {
  const lines = csv.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((h) => h.trim())
  const iLat = header.indexOf("latitude")
  const iLon = header.indexOf("longitude")
  if (iLat < 0 || iLon < 0) return []

  const out: HistoricalFirePoint[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",")
    const lat = Number.parseFloat(cells[iLat])
    const lon = Number.parseFloat(cells[iLon])
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon })
  }
  return out
}

async function fetchChunk(mapKey: string, chunkEndDate: Date): Promise<HistoricalFirePoint[]> {
  const url = `${BASE_URL}/${mapKey}/${RECURRENCE_SOURCE}/${areaCoordinates()}/${CHUNK_DAYS}/${formatDate(chunkEndDate)}`
  const res = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
    headers: { Accept: "text/csv" },
  })
  const body = await res.text()
  // Same plain-text-error-with-HTTP-200 quirk documented in lib/firms/client.ts.
  if (body.startsWith("Invalid") || body.includes("Invalid MAP_KEY") || body.includes("You have exceeded")) {
    throw new Error(body.trim().slice(0, 200))
  }
  if (!res.ok) throw new Error(`FIRMS historical query failed (${res.status})`)
  return parseLatLon(body)
}

/**
 * Fetches every VIIRS detection in the study area over the trailing
 * LOOKBACK_DAYS, paging backward in 5-day chunks with limited
 * concurrency. Individual chunk failures are skipped rather than failing
 * the whole batch — a partial outage thins the recurrence sample instead
 * of blanking this factor for every vereda.
 */
export async function getHistoricalFireDetections(): Promise<HistoricalFirePoint[]> {
  const envKey = process.env.FIRMS_MAP_KEY
  if (!envKey) return []
  const mapKey: string = envKey

  // Anchor one day back, same reasoning as the live fires client: FIRMS'
  // most recent day is often still incomplete.
  const anchor = new Date()
  anchor.setUTCDate(anchor.getUTCDate() - 1)

  const chunkEnds: Date[] = []
  for (let daysBack = 0; daysBack < LOOKBACK_DAYS; daysBack += CHUNK_DAYS) {
    const chunkEnd = new Date(anchor)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() - daysBack)
    chunkEnds.push(chunkEnd)
  }

  const points: HistoricalFirePoint[] = []
  let cursor = 0
  async function worker() {
    while (cursor < chunkEnds.length) {
      const index = cursor++
      try {
        points.push(...(await fetchChunk(mapKey, chunkEnds[index])))
      } catch {
        // Skip this window; the rest of the lookback still contributes.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunkEnds.length) }, worker))

  return points
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

/** Detections farther than this (km) from a centroid don't count toward its recurrence factor. */
const RECURRENCE_RADIUS_KM = 2
/** Detection count at/above which the recurrence score saturates to 1. */
const RECURRENCE_SATURATION_COUNT = 3

export interface FireHistoryResult {
  /** Raw detection count within RECURRENCE_RADIUS_KM over the lookback window. */
  count: number
  /** 0–1, saturating at RECURRENCE_SATURATION_COUNT detections. */
  score: number
}

/** Counts historical detections near a centroid and converts the count to a saturating 0–1 score. */
export function fireHistoryScore(
  lat: number,
  lon: number,
  points: readonly HistoricalFirePoint[],
): FireHistoryResult {
  let count = 0
  for (const p of points) {
    if (haversineKm(lat, lon, p.lat, p.lon) <= RECURRENCE_RADIUS_KM) count++
  }
  return { count, score: Math.min(1, count / RECURRENCE_SATURATION_COUNT) }
}
