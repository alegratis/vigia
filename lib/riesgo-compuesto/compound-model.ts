import "server-only"

/**
 * Combines this app's four already-computed per-vereda hazard
 * classifications into one compound assessment. No new external data
 * source or invented algorithm — see lib/riesgo-compuesto/levels.ts for
 * the two precedented approaches this follows (WMO/GDACS max-ordinal tier,
 * INFORM-style weighted composite score).
 *
 * Each hazard is normalized to a 0–1 "how bad is it here" score before
 * combining, using whichever of that hazard's own fields is already
 * continuous:
 *
 * - Deslizamientos: `hazard-model.ts`'s own 0–1 `score` (higher = worse) —
 *   used as-is.
 * - Inundaciones (own model): `hazard-model.ts`'s own 0–1 `floodScoreAvg`
 *   (already higher = worse, per its own `zoningLevelToScore` convention)
 *   — used as-is.
 * - Incendios: no continuous score exists (the `AmenazaIncendios` layer
 *   only publishes a 4-tier label) — its ordinal index over
 *   `FIRE_THREAT_LEVELS` (Muy bajo=0 … Alto=1, i.e. index/(n-1)) stands in
 *   for a score, the same technique `zoningLevelToScore` already uses in
 *   the flood model for a level-only input.
 * - Precipitación: same technique, over `PRECIPITATION_LEVELS`.
 */

import { FIRE_THREAT_LEVELS, type FireThreatLevel } from "@/lib/incendios/levels"
import { PRECIPITATION_LEVELS, type PrecipitationLevel } from "@/lib/precipitacion/levels"
import type { SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import type { FloodSusceptibilityLevel } from "@/lib/inundaciones/levels"
import { compoundLevelFromScore, type CompoundLevel } from "./levels"
import type { HazardName, SubHazardSummary } from "./api-types"

/** Equal 25% weights by default — re-normalized over whichever hazards resolved for a given vereda. */
const HAZARD_WEIGHT = 0.25

function ordinalScore<T extends string>(levels: readonly T[], value: T | null): number | null {
  if (value == null) return null
  const index = levels.indexOf(value)
  if (index < 0) return null
  return levels.length > 1 ? index / (levels.length - 1) : index
}

export interface CompoundModelInput {
  deslizamientos: { level: SusceptibilityLevel | null; score: number | null }
  inundaciones: { level: FloodSusceptibilityLevel | null; score: number | null }
  incendios: { level: FireThreatLevel | null }
  precipitacion: { level: PrecipitationLevel | null; accumulatedMm: number | null }
}

export interface CompoundModelResult {
  compoundLevel: CompoundLevel | null
  compoundScore: number | null
  dominantHazard: HazardName | null
  subHazards: SubHazardSummary[]
}

const HAZARD_LABELS: Record<HazardName, string> = {
  deslizamientos: "Deslizamientos",
  inundaciones: "Inundaciones",
  incendios: "Incendios forestales",
  precipitacion: "Precipitación",
}

/**
 * Computes the compound level/score/dominant hazard for one vereda from
 * its four already-resolved hazard inputs. Combines only the hazards that
 * actually resolved — re-normalizing weights over just those — so a
 * vereda missing one input (e.g. outside the incendios layer's Sevilla/
 * Caicedonia coverage) still gets a meaningful result from the other
 * three, never a fabricated score. A vereda with all four unresolved gets
 * `null` everywhere, the same "no data" convention used throughout this
 * app.
 */
export function computeCompoundVeredaRisk(input: CompoundModelInput): CompoundModelResult {
  const deslizamientosNorm = input.deslizamientos.score
  const inundacionesNorm = input.inundaciones.score
  const incendiosNorm = ordinalScore(FIRE_THREAT_LEVELS, input.incendios.level)
  const precipitacionNorm = ordinalScore(PRECIPITATION_LEVELS, input.precipitacion.level)

  const normalized: Record<HazardName, number | null> = {
    deslizamientos: deslizamientosNorm,
    inundaciones: inundacionesNorm,
    incendios: incendiosNorm,
    precipitacion: precipitacionNorm,
  }

  const rawLevels: Record<HazardName, string | null> = {
    deslizamientos: input.deslizamientos.level,
    inundaciones: input.inundaciones.level,
    incendios: input.incendios.level,
    precipitacion: input.precipitacion.level,
  }

  const order: HazardName[] = ["deslizamientos", "inundaciones", "incendios", "precipitacion"]

  // Weighted composite (INFORM style): equal weights, re-normalized over resolved hazards only.
  let weightedSum = 0
  let totalWeight = 0
  for (const hazard of order) {
    const score = normalized[hazard]
    if (score != null) {
      weightedSum += score * HAZARD_WEIGHT
      totalWeight += HAZARD_WEIGHT
    }
  }
  const compoundScore = totalWeight > 0 ? weightedSum / totalWeight : null

  // Max-ordinal tier (WMO/GDACS doctrine): each hazard's own normalized score maps onto the
  // shared 5-level scale, and the highest tier across the four governs — never diluted by the calmer ones.
  let compoundLevel: CompoundLevel | null = null
  let dominantHazard: HazardName | null = null
  let bestTierIndex = -1
  let bestScore = -1
  for (const hazard of order) {
    const score = normalized[hazard]
    if (score == null) continue
    const level = compoundLevelFromScore(score)
    const tierIndex = ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto"].indexOf(level)
    if (tierIndex > bestTierIndex || (tierIndex === bestTierIndex && score > bestScore)) {
      bestTierIndex = tierIndex
      bestScore = score
      compoundLevel = level
      dominantHazard = hazard
    }
  }

  const subHazards: SubHazardSummary[] = order.map((hazard) => ({
    hazard,
    label: HAZARD_LABELS[hazard],
    rawLevel: rawLevels[hazard],
    normalizedScore: normalized[hazard],
    colorToken: colorTokenFor(hazard, rawLevels[hazard]),
    detail: null, // filled in by lib/riesgo-compuesto/server.ts, which has the underlying factor values.
  }))

  return { compoundLevel, compoundScore, dominantHazard, subHazards }
}

function colorTokenFor(hazard: HazardName, rawLevel: string | null): string {
  if (!rawLevel) return "var(--muted-foreground)"
  switch (hazard) {
    case "deslizamientos":
      return `var(--deslizamientos-${slug(rawLevel)})`
    case "inundaciones":
      return `var(--inundaciones-${slugFlood(rawLevel)})`
    case "incendios":
      return `var(--incendios-${slug(rawLevel)})`
    case "precipitacion":
      return `var(--precipitacion-${slug(rawLevel)})`
  }
}

function slug(level: string): string {
  return level
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
}

// Inundaciones' own CSS tokens use the feminine forms ("muy-alta"/"muy-baja") already published in
// FLOOD_SUSCEPTIBILITY_LEVELS, so its slug doesn't need any special-casing beyond the shared slug() above —
// kept as a separate name only so a future divergence between the two vocabularies is easy to spot.
const slugFlood = slug
