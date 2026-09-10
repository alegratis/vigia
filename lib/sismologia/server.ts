import "server-only"

/**
 * Builds the combined response for /api/sismologia/eventos: USGS's live
 * feed plus SGC's historical catalog over the same AOI, each resolved
 * independently so one source's failure never blanks the other (same
 * "don't fabricate, don't cascade" convention used across this app, e.g.
 * lib/riesgo-compuesto/incendios-join.ts).
 */

import { getUsgsEvents, type Bbox } from "./usgs"
import { getSgcEvents } from "./sgc"
import type { SismologiaEventosResponse } from "./api-types"

/** Same AOI used by the other hazard maps (Sevilla/Caicedonia/Zarzal), padded to catch nearby regional events that still influence exposure. */
export const SISMOLOGIA_BBOX: Bbox = { south: 3.4, west: -76.6, north: 5.2, east: -75.2 }

const USGS_WINDOW_DAYS = 90

export async function getSismologiaEventos(): Promise<SismologiaEventosResponse> {
  const [usgsResult, sgcResult] = await Promise.allSettled([
    getUsgsEvents(SISMOLOGIA_BBOX, USGS_WINDOW_DAYS),
    getSgcEvents(SISMOLOGIA_BBOX),
  ])

  return {
    generatedAt: new Date().toISOString(),
    bbox: SISMOLOGIA_BBOX,
    usgs: {
      events: usgsResult.status === "fulfilled" ? usgsResult.value : [],
      windowDays: USGS_WINDOW_DAYS,
      ok: usgsResult.status === "fulfilled",
    },
    sgc: {
      events: sgcResult.status === "fulfilled" ? sgcResult.value : [],
      ok: sgcResult.status === "fulfilled",
    },
  }
}
