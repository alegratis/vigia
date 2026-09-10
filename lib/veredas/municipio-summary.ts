/**
 * Client-safe aggregation of the per-vereda hazard model (see
 * lib/deslizamientos/hazard-model.ts) up to the municipio level, for the
 * "Cómo se calcula la amenaza" panel below the deslizamientos map. Pure
 * arithmetic over data the map already has via useVeredas — no extra
 * request, no server import.
 *
 * Also aggregates the flood hazard model (lib/inundaciones/hazard-model.ts)
 * the same way, for the equivalent panel on the inundaciones map —
 * including `floodZoningCoverage`, which lets that panel honestly report
 * e.g. "0/9 veredas de Zarzal con zonificación oficial" alongside the
 * model's own full coverage.
 */

import { SUSCEPTIBILITY_LEVELS, type SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import { FLOOD_SUSCEPTIBILITY_LEVELS, type FloodSusceptibilityLevel } from "@/lib/inundaciones/levels"
import type { VeredaFeature, VeredasFeatureCollection } from "./api-types"

export interface MunicipioHazardSummary {
  municipio: string
  totalVeredas: number
  /** Veredas with a non-null hazard score — some may have failed every input factor. */
  veredasConDatos: number
  scoreAvg: number | null
  slopeDegAvg: number | null
  roadDistanceKmAvg: number | null
  faultDistanceKmAvg: number | null
  historyDistanceKmAvg: number | null
  rainfallRatioAvg: number | null
  /** Count of veredas at each hazard level, in SUSCEPTIBILITY_LEVELS order. */
  levelCounts: Record<SusceptibilityLevel, number>

  /** Flood hazard model averages — see lib/inundaciones/hazard-model.ts. */
  floodScoreAvg: number | null
  floodStreamDistanceKmAvg: number | null
  /** Count of veredas at each flood hazard level, in FLOOD_SUSCEPTIBILITY_LEVELS order. */
  floodLevelCounts: Record<FloodSusceptibilityLevel, number>
  /** How many of this municipio's veredas fall inside the official zoning layer's coverage — 0 for Zarzal. */
  floodZoningCoverage: { covered: number; total: number }
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null)
  return present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null
}

/** Groups vereda features by municipio and averages each hazard-model factor over the veredas that resolved it. */
export function summarizeByMunicipio(veredas: VeredasFeatureCollection): MunicipioHazardSummary[] {
  const byMunicipio = new Map<string, VeredaFeature[]>()
  for (const feature of veredas.features) {
    const list = byMunicipio.get(feature.properties.municipio)
    if (list) list.push(feature)
    else byMunicipio.set(feature.properties.municipio, [feature])
  }

  return Array.from(byMunicipio.entries())
    .map(([municipio, features]) => {
      const levelCounts = Object.fromEntries(SUSCEPTIBILITY_LEVELS.map((l) => [l, 0])) as Record<
        SusceptibilityLevel,
        number
      >
      for (const f of features) {
        const level = f.properties.dominantLevel
        if (level && level in levelCounts) levelCounts[level as SusceptibilityLevel]++
      }

      const floodLevelCounts = Object.fromEntries(
        FLOOD_SUSCEPTIBILITY_LEVELS.map((l) => [l, 0]),
      ) as Record<FloodSusceptibilityLevel, number>
      for (const f of features) {
        const level = f.properties.floodLevel
        if (level && level in floodLevelCounts) floodLevelCounts[level as FloodSusceptibilityLevel]++
      }

      return {
        municipio,
        totalVeredas: features.length,
        veredasConDatos: features.filter((f) => f.properties.isScoreAvg != null).length,
        scoreAvg: average(features.map((f) => f.properties.isScoreAvg)),
        slopeDegAvg: average(features.map((f) => f.properties.slopeDeg)),
        roadDistanceKmAvg: average(features.map((f) => f.properties.roadDistanceKm)),
        faultDistanceKmAvg: average(features.map((f) => f.properties.faultDistanceKm)),
        historyDistanceKmAvg: average(features.map((f) => f.properties.historyDistanceKm)),
        rainfallRatioAvg: average(features.map((f) => f.properties.rainfallRatio)),
        levelCounts,
        floodScoreAvg: average(features.map((f) => f.properties.floodScoreAvg)),
        floodStreamDistanceKmAvg: average(features.map((f) => f.properties.floodStreamDistanceKm)),
        floodLevelCounts,
        floodZoningCoverage: {
          covered: features.filter((f) => f.properties.floodZoningCovered).length,
          total: features.length,
        },
      }
    })
    .sort((a, b) => a.municipio.localeCompare(b.municipio, "es"))
}
