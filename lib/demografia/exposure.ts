import "server-only"

/**
 * Combines DANE population figures with the live flood and fire signals to
 * produce a per-municipality exposure snapshot.
 *
 * This intentionally stops short of claiming a precise "people flooded"
 * count — there is no open flood-extent or landslide-susceptibility polygon
 * for the study area yet. Instead it cross-references each municipality's
 * population (rural population is the relevant base for river corridors,
 * forest fires and hillside landslides; urban population for in-town flood
 * channels) against the current hazard signal, so the number shown is always
 * traceable to a real census figure plus a real live reading.
 */

import { STATIONS } from "@/lib/geoglows/stations"
import { assessReach } from "@/lib/geoglows/service"
import type { FloodLevelKey } from "@/lib/geoglows/flood"
import { getAreaFires, FirmsConfigError } from "@/lib/firms/client"
import { summarize } from "@/lib/firms/summary"
import { getMunicipioPopulations, type MunicipioPopulation } from "./dane"

const SEVERITY_RANK: Record<FloodLevelKey, number> = {
  normal: 0,
  vigilancia: 1,
  alerta: 2,
  alerta_alta: 3,
  emergencia: 4,
  extrema: 5,
}

export interface MunicipioExposure {
  municipio: string
  population: MunicipioPopulation
  flood: { worstLevel: FloodLevelKey; stationCount: number } | null
  fire: { count: number; highConfidence: number } | null
}

export interface ExposureResult {
  municipios: MunicipioExposure[]
  floodError: string | null
  fireError: string | null
  fireNeedsConfig: boolean
}

export async function getExposureOverview(): Promise<ExposureResult> {
  const [populations, floodSettled, fireOutcome] = await Promise.all([
    getMunicipioPopulations(),
    Promise.allSettled(STATIONS.map((s) => assessReach(s.reachId))),
    (async () => {
      try {
        const result = await getAreaFires(3)
        return { ok: true as const, summary: summarize(result.detections) }
      } catch (err) {
        return {
          ok: false as const,
          needsConfig: err instanceof FirmsConfigError,
          error: err instanceof Error ? err.message : "Error al consultar NASA FIRMS",
        }
      }
    })(),
  ])

  const floodLevelsByMun = new Map<string, FloodLevelKey[]>()
  let floodError: string | null = null
  floodSettled.forEach((result, i) => {
    const station = STATIONS[i]
    if (result.status === "rejected") {
      floodError =
        result.reason instanceof Error ? result.reason.message : "Error GEOGLOWS"
      return
    }
    const list = floodLevelsByMun.get(station.municipality) ?? []
    list.push(result.value.current.level.key)
    floodLevelsByMun.set(station.municipality, list)
  })

  const fireByMun = new Map<string, { count: number; highConfidence: number }>()
  let fireError: string | null = null
  let fireNeedsConfig = false
  if (fireOutcome.ok) {
    for (const m of fireOutcome.summary.byMunicipality) {
      fireByMun.set(m.name, { count: m.count, highConfidence: m.highConfidence })
    }
  } else {
    fireError = fireOutcome.error
    fireNeedsConfig = fireOutcome.needsConfig
  }

  const municipios: MunicipioExposure[] = populations.map((population) => {
    const levels = floodLevelsByMun.get(population.municipio)
    const flood =
      levels && levels.length > 0
        ? {
            worstLevel: levels.reduce(
              (worst, l) => (SEVERITY_RANK[l] > SEVERITY_RANK[worst] ? l : worst),
              levels[0],
            ),
            stationCount: levels.length,
          }
        : null

    const fire = fireOutcome.ok
      ? fireByMun.get(population.municipio) ?? { count: 0, highConfidence: 0 }
      : null

    return { municipio: population.municipio, population, flood, fire }
  })

  return { municipios, floodError, fireError, fireNeedsConfig }
}
