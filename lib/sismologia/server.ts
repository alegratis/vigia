import "server-only"

/**
 * Builds the combined response for /api/sismologia/eventos from three
 * independently-resolved sources (one source failing never blanks the
 * others — the same "don't fabricate, don't cascade" convention used
 * across this app, e.g. lib/riesgo-compuesto/incendios-join.ts):
 *
 *  - SGC RSNC live feed (lib/sismologia/sgc-live.ts): the primary live
 *    source, dense enough to catch small local tremors (M1–M4) that USGS's
 *    global catalog misses.
 *  - USGS FDSN (lib/sismologia/usgs.ts): kept as an independent, longer
 *    (90-day) cross-check with human-readable place strings.
 *  - SGC historical ArcGIS catalog (lib/sismologia/sgc.ts): the deep,
 *    positional archive.
 *
 * When the same quake appears in more than one source we keep a single
 * copy, preferring SGC (denser local network, more precise regional
 * locations) over USGS, so the map doesn't draw it twice and the exposure
 * score doesn't count it twice.
 */

import { getUsgsEvents, type Bbox } from "./usgs"
import { getSgcEvents } from "./sgc"
import { getSgcLiveEvents, SGC_LIVE_WINDOW_DAYS } from "./sgc-live"
import type { SeismicEvent, SismologiaEventosResponse } from "./api-types"

/** Same AOI used by the other hazard maps (Sevilla/Caicedonia/Zarzal), padded to catch nearby regional events that still influence exposure. */
export const SISMOLOGIA_BBOX: Bbox = { south: 3.4, west: -76.6, north: 5.2, east: -75.2 }

const USGS_WINDOW_DAYS = 90

/** Two records are treated as the same quake if close in time, space and magnitude. */
const DEDUPE_MAX_SECONDS = 40
const DEDUPE_MAX_KM = 60
const DEDUPE_MAX_MAG_DIFF = 1.5

/** Cheap great-circle distance (km) — avoids pulling turf into this hot path. */
function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function isSameQuake(a: SeismicEvent, b: SeismicEvent): boolean {
  const dt = Math.abs(new Date(a.time).getTime() - new Date(b.time).getTime())
  if (dt > DEDUPE_MAX_SECONDS * 1000) return false
  if (Math.abs(a.magnitude - b.magnitude) > DEDUPE_MAX_MAG_DIFF) return false
  return distanceKm(a.lat, a.lon, b.lat, b.lon) <= DEDUPE_MAX_KM
}

/** Returns the candidates that do NOT duplicate any already-kept event. */
function dropDuplicates(candidates: SeismicEvent[], kept: SeismicEvent[]): SeismicEvent[] {
  return candidates.filter((c) => !kept.some((k) => isSameQuake(c, k)))
}

export async function getSismologiaEventos(): Promise<SismologiaEventosResponse> {
  const [sgcLiveResult, usgsResult, sgcResult] = await Promise.allSettled([
    getSgcLiveEvents(SISMOLOGIA_BBOX),
    getUsgsEvents(SISMOLOGIA_BBOX, USGS_WINDOW_DAYS),
    getSgcEvents(SISMOLOGIA_BBOX),
  ])

  const sgcLiveEvents = sgcLiveResult.status === "fulfilled" ? sgcLiveResult.value : []
  const usgsEventsRaw = usgsResult.status === "fulfilled" ? usgsResult.value : []
  const sgcEventsRaw = sgcResult.status === "fulfilled" ? sgcResult.value : []

  // Priority: SGC live > SGC historical > USGS. Keep SGC live intact, then
  // drop from each lower-priority source anything already represented above.
  const sgcEvents = dropDuplicates(sgcEventsRaw, sgcLiveEvents)
  const usgsEvents = dropDuplicates(usgsEventsRaw, [...sgcLiveEvents, ...sgcEvents])

  return {
    generatedAt: new Date().toISOString(),
    bbox: SISMOLOGIA_BBOX,
    sgcLive: {
      events: sgcLiveEvents,
      windowDays: SGC_LIVE_WINDOW_DAYS,
      ok: sgcLiveResult.status === "fulfilled",
    },
    usgs: {
      events: usgsEvents,
      windowDays: USGS_WINDOW_DAYS,
      ok: usgsResult.status === "fulfilled",
    },
    sgc: {
      events: sgcEvents,
      ok: sgcResult.status === "fulfilled",
    },
  }
}
