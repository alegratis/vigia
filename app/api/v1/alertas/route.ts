import type { NextRequest } from "next/server"
import { fail, ok, preflight } from "@/lib/api/v1"
import { ALERT_HAZARDS } from "@/lib/alertas/types"
import { getRecentLiveAlerts, HISTORY_WINDOW_HOURS } from "@/lib/alertas/history"

export const OPTIONS = preflight

export async function GET(request: NextRequest) {
  const amenaza = request.nextUrl.searchParams.get("amenaza")
  if (amenaza !== null && !(ALERT_HAZARDS as readonly string[]).includes(amenaza)) {
    return fail(400, "invalid_parameter", `El parámetro amenaza debe ser uno de: ${ALERT_HAZARDS.join(", ")}.`)
  }

  try {
    const alertas = (await getRecentLiveAlerts())
      .filter((a) => amenaza === null || a.hazard === amenaza)
      .map((a) => ({
        id: a.id,
        amenaza: a.hazard,
        nivel: a.tier,
        zona: a.zone,
        fecha: a.createdAt,
        magnitud: a.magnitude,
      }))

    return ok(alertas, {
      cacheSeconds: 60,
      meta: { total: alertas.length, ventanaHoras: HISTORY_WINDOW_HOURS },
    })
  } catch {
    return fail(502, "upstream_error", "No se pudo leer el historial de alertas.")
  }
}
