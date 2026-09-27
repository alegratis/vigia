/**
 * Step 3 of the vulnerability-index methodology (see v0_plans/grand-method.md,
 * Part A) — the Combined Vulnerability Score, per vereda:
 *
 *   Combined Score = IVS(vereda's municipio) × Hazard Score(vereda)
 *
 * The same multiplicative Risk = Vulnerability × Hazard formula from the
 * instructions. `IVS` comes from lib/vulnerabilidad/ivs.ts (0–1, per
 * municipio). `Hazard Score` is this app's own `riesgo-compuesto`
 * `compoundScore`/`compoundLevel` (lib/riesgo-compuesto/compound-model.ts),
 * rescaled from its 5-tier vocabulary onto the instructions' 1–4 scale so
 * the final range matches the methodology's expectation — never
 * re-derived from a second, parallel hazard pipeline. No server imports:
 * pure functions over already-resolved inputs.
 */

import type { CompoundLevel } from "@/lib/riesgo-compuesto/levels"

/** Muy bajo/Bajo → 1, Moderado → 2, Alto → 3, Muy alto → 4 — the instructions' 1–4 hazard reclassification scale. */
const HAZARD_SCORE_BY_LEVEL: Record<CompoundLevel, number> = {
  "Muy bajo": 1,
  Bajo: 1,
  Moderado: 2,
  Alto: 3,
  "Muy alto": 4,
}

export function hazardScoreFromCompoundLevel(level: CompoundLevel): number {
  return HAZARD_SCORE_BY_LEVEL[level]
}

export const VULNERABILITY_LEVELS = ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto"] as const
export type VulnerabilityLevel = (typeof VULNERABILITY_LEVELS)[number]

/** Combined score's theoretical range: IVS ∈ [0,1] × HazardScore ∈ [1,4] → [0,4]. Quintiles of that fixed range, matching the compound model's own 0.2-step scheme. */
export function vulnerabilityLevelFromScore(combinedScore: number): VulnerabilityLevel {
  const normalized = combinedScore / 4
  if (normalized < 0.2) return "Muy bajo"
  if (normalized < 0.4) return "Bajo"
  if (normalized < 0.6) return "Moderado"
  if (normalized < 0.8) return "Alto"
  return "Muy alto"
}

export interface CombinedVulnerabilityInput {
  /** Social Vulnerability Index for this vereda's municipio, 0–1 (higher = more socially vulnerable). */
  ivs: number
  /** This vereda's existing riesgo-compuesto tier — the hazard side of the formula. */
  compoundLevel: CompoundLevel | null
}

export interface CombinedVulnerabilityResult {
  ivs: number
  hazardScore: number | null
  /** IVS × HazardScore, range [0, 4]. `null` if the vereda has no resolved hazard tier. */
  combinedScore: number | null
  combinedLevel: VulnerabilityLevel | null
}

export function computeCombinedVulnerability(input: CombinedVulnerabilityInput): CombinedVulnerabilityResult {
  if (input.compoundLevel == null) {
    return { ivs: input.ivs, hazardScore: null, combinedScore: null, combinedLevel: null }
  }
  const hazardScore = hazardScoreFromCompoundLevel(input.compoundLevel)
  const combinedScore = input.ivs * hazardScore
  return {
    ivs: input.ivs,
    hazardScore,
    combinedScore,
    combinedLevel: vulnerabilityLevelFromScore(combinedScore),
  }
}
