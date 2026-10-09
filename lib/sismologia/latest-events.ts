import type { SeismicEvent, SismologiaEventosResponse } from "./api-types"
import { isMinorQuake } from "./levels"

/** Two catalogs reporting the same quake differ by seconds and a few km — treat anything inside these as one event. */
const DUPLICATE_WINDOW_MS = 3 * 60_000
const DUPLICATE_DEGREES = 0.6

function isSameQuake(a: SeismicEvent, b: SeismicEvent): boolean {
  return (
    Math.abs(new Date(a.time).getTime() - new Date(b.time).getTime()) <= DUPLICATE_WINDOW_MS &&
    Math.abs(a.lat - b.lat) <= DUPLICATE_DEGREES &&
    Math.abs(a.lon - b.lon) <= DUPLICATE_DEGREES
  )
}

/**
 * The N most recent distinct quakes across the live SGC and USGS feeds, newest first.
 * SGC live is listed first so it wins when both catalogs report the same event.
 * Only quakes at or above MIN_NUMBERED_MAGNITUDE qualify — smaller ones are still drawn on the map, just not numbered.
 */
export function getLatestSeismicEvents(data: SismologiaEventosResponse | undefined, count = 3): SeismicEvent[] {
  if (!data) return []
  const sorted = [...data.sgcLive.events, ...data.usgs.events]
    .filter((event) => !isMinorQuake(Number(event.magnitude)))
    .sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  )
  const distinct: SeismicEvent[] = []
  for (const event of sorted) {
    if (distinct.some((kept) => isSameQuake(kept, event))) continue
    distinct.push(event)
    if (distinct.length === count) break
  }
  return distinct
}

/** "hace 12 min", "hace 3 h", "hace 2 d" — coarse relative time for the latest-quake markers and list. */
export function formatQuakeAge(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return "hace instantes"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}
