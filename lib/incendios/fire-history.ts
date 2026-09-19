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
 * one request for the whole window. Queries every FIRMS source the live
 * map itself offers (`FIRMS_SOURCES` from lib/firms/area.ts — VIIRS_SNPP,
 * VIIRS_NOAA20, VIIRS_NOAA21 and MODIS), not just one sensor: the live
 * "Focos activos" layer shows all four, so the historical recurrence
 * factor — the model's single highest-weighted input — would otherwise
 * be blind to fires that only VIIRS_NOAA20/21 or MODIS caught, silently
 * undercounting recurrence at centroids those extra platforms cover.
 * Overlapping platforms of the same sensor family (e.g. the three VIIRS
 * sources) can report the same fire pixel more than once per day, so
 * results are coarsely deduped per sensor family before counting —
 * same rationale as lib/firms/client.ts's `dedupe()` for the live layer.
 */

import { areaCoordinates, FIRMS_SOURCES, firmsSensor, type FirmsSource } from "@/lib/firms/area"

const BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
/** FIRMS area/csv day-range cap for this app's map key. */
const CHUNK_DAYS = 5
/** How far back the recurrence window reaches — long enough to catch a full local dry season, short enough to keep the chunked request count reasonable. */
const LOOKBACK_DAYS = 150
/** How many (source, chunk) requests run at once — polite to FIRMS' rate limits, still fast enough for a ~120-request window (4 sources × ~30 chunks). */
const CONCURRENCY = 8
// A past window's detections never change once published; cache generously.
const REVALIDATE_SECONDS = 21_600 // 6 hours

export interface HistoricalFirePoint {
  lat: number
  lon: number
  /** Which sensor family this detection came from — used only to dedupe overlapping platforms of the same family, never exposed past this module. */
  sensor: "modis" | "viirs"
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Minimal CSV parse — only the columns this factor needs, unlike lib/firms/client.ts's full FireDetection parser. */
function parseLatLon(csv: string, sensor: "modis" | "viirs"): HistoricalFirePoint[] {
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
    if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon, sensor })
  }
  return out
}

async function fetchChunk(mapKey: string, source: FirmsSource, chunkEndDate: Date): Promise<HistoricalFirePoint[]> {
  const url = `${BASE_URL}/${mapKey}/${source}/${areaCoordinates()}/${CHUNK_DAYS}/${formatDate(chunkEndDate)}`
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
  return parseLatLon(body, firmsSensor(source))
}

/** Collapses detections from overlapping platforms of the *same* sensor family (e.g. VIIRS_SNPP + VIIRS_NOAA20 both reporting one fire) that fall on the same ~100m/day cell, so recurrence counts aren't inflated by multi-satellite coverage of a single fire. */
function dedupeBySensor(points: HistoricalFirePoint[]): HistoricalFirePoint[] {
  const seen = new Set<string>()
  const out: HistoricalFirePoint[] = []
  for (const p of points) {
    const key = `${p.sensor}-${p.lat.toFixed(3)}-${p.lon.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

/**
 * Fetches every FIRMS detection (all sources the live map itself offers —
 * VIIRS_SNPP, VIIRS_NOAA20, VIIRS_NOAA21 and MODIS) in the study area over
 * the trailing LOOKBACK_DAYS, paging backward in 5-day chunks per source
 * with limited concurrency across the full (source × chunk) job list.
 * Individual chunk failures are skipped rather than failing the whole
 * batch — a partial outage thins the recurrence sample instead of
 * blanking this factor for every vereda.
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

  const jobs: Array<{ source: FirmsSource; chunkEnd: Date }> = []
  for (const source of FIRMS_SOURCES) {
    for (const chunkEnd of chunkEnds) jobs.push({ source, chunkEnd })
  }

  const points: HistoricalFirePoint[] = []
  let cursor = 0
  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor++
      const { source, chunkEnd } = jobs[index]
      try {
        points.push(...(await fetchChunk(mapKey, source, chunkEnd)))
      } catch {
        // Skip this (source, window) pair; the rest of the lookback still contributes.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker))

  return dedupeBySensor(points)
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
