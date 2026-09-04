import { NextResponse } from "next/server"
import { assessReach } from "@/lib/geoglows/service"
import { STATIONS, DEPARTMENT } from "@/lib/geoglows/stations"
import type { FloodLevelKey } from "@/lib/geoglows/flood"

const SEVERITY_RANK: Record<FloodLevelKey, number> = {
  normal: 0,
  vigilancia: 1,
  alerta: 2,
  alerta_alta: 3,
  emergencia: 4,
  extrema: 5,
}

/**
 * Compact flood overview for every monitored station. Assessments run in
 * parallel; a failing station degrades to an error entry instead of failing
 * the whole request. The heavy per-step series is omitted here — use
 * /api/reaches/<id> for the full time series.
 */
export async function GET() {
  const results = await Promise.allSettled(STATIONS.map((s) => assessReach(s.reachId)))

  const stations = results.map((result, i) => {
    const station = STATIONS[i]
    if (result.status === "rejected") {
      return {
        station,
        ok: false as const,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : "Fallo al evaluar el tramo",
      }
    }

    const a = result.value
    return {
      station,
      ok: true as const,
      generatedAt: a.generatedAt,
      units: a.units,
      thresholds: a.thresholds,
      current: a.current,
      peak: a.peak,
      peakUpper: a.peakUpper,
      medianExceedance: a.medianExceedance,
      upperExceedance: a.upperExceedance,
    }
  })

  let worst: { slug: string; level: FloodLevelKey } | null = null
  for (const s of stations) {
    if (!s.ok) continue
    const level = s.current.level.key
    if (worst === null || SEVERITY_RANK[level] > SEVERITY_RANK[worst.level]) {
      worst = { slug: s.station.slug, level }
    }
  }

  return NextResponse.json({
    department: DEPARTMENT,
    generatedAt: new Date().toISOString(),
    count: stations.length,
    stations,
    worst,
  })
}
