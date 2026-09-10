/**
 * Shared, client-safe metadata for the "Riesgo compuesto" (compound
 * multi-hazard) category. This is not a published index — it's this app's
 * own combination of the four hazards it already models per vereda
 * (deslizamientos, inundaciones, incendios, precipitación), following two
 * precedented approaches rather than inventing a new one:
 *
 * - WMO/GDACS doctrine ("highest hazard governs"): `compoundLevel` is the
 *   max ordinal tier across the four hazards, each mapped onto this same
 *   5-level scale from its own 0–1 normalized score (see
 *   lib/riesgo-compuesto/compound-model.ts) — a single severe hazard is
 *   never diluted by three calm ones.
 * - INFORM Risk Index style (weighted composite): `compoundScore` is a
 *   continuous 0–1 weighted average of the four normalized scores, used
 *   for intra-tier ranking rather than the headline tier itself.
 *
 * `IDEAM_ACTION_TIERS` additionally maps the compound tier onto the
 * Informar/Prepararse/Actuar framing IDEAM already uses in its own public
 * bulletins, since it's the vocabulary Colombian officials/municipios
 * already recognize. No server imports here.
 */

export const COMPOUND_LEVELS = ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto"] as const
export type CompoundLevel = (typeof COMPOUND_LEVELS)[number]

export const IDEAM_ACTION_TIERS = ["Informar", "Prepararse", "Actuar"] as const
export type IdeamActionTier = (typeof IDEAM_ACTION_TIERS)[number]

export interface CompoundLevelStyle {
  label: CompoundLevel
  swatchClass: string
  colorToken: string
}

export const COMPOUND_LEVEL_STYLES: Record<CompoundLevel, CompoundLevelStyle> = {
  "Muy bajo": {
    label: "Muy bajo",
    swatchClass: "bg-riesgo-compuesto-muy-bajo",
    colorToken: "var(--riesgo-compuesto-muy-bajo)",
  },
  Bajo: {
    label: "Bajo",
    swatchClass: "bg-riesgo-compuesto-bajo",
    colorToken: "var(--riesgo-compuesto-bajo)",
  },
  Moderado: {
    label: "Moderado",
    swatchClass: "bg-riesgo-compuesto-moderado",
    colorToken: "var(--riesgo-compuesto-moderado)",
  },
  Alto: {
    label: "Alto",
    swatchClass: "bg-riesgo-compuesto-alto",
    colorToken: "var(--riesgo-compuesto-alto)",
  },
  "Muy alto": {
    label: "Muy alto",
    swatchClass: "bg-riesgo-compuesto-muy-alto",
    colorToken: "var(--riesgo-compuesto-muy-alto)",
  },
}

export function isCompoundLevel(value: string): value is CompoundLevel {
  return (COMPOUND_LEVELS as readonly string[]).includes(value)
}

/** Score cutoffs shared by every 0–1 normalized hazard input and the final composite — same 0.2/0.4/0.6/0.8 scheme used throughout this app. */
export function compoundLevelFromScore(score: number): CompoundLevel {
  if (score < 0.2) return "Muy bajo"
  if (score < 0.4) return "Bajo"
  if (score < 0.6) return "Moderado"
  if (score < 0.8) return "Alto"
  return "Muy alto"
}

/** IDEAM's 3-tier action framing for a compound level: Informar (Muy bajo/Bajo), Prepararse (Moderado), Actuar (Alto/Muy alto). */
export function actionTierFor(level: CompoundLevel): IdeamActionTier {
  if (level === "Muy bajo" || level === "Bajo") return "Informar"
  if (level === "Moderado") return "Prepararse"
  return "Actuar"
}

/** Raw CSS color token for a level, falling back to a neutral tone for unrecognized values. */
export function compoundLevelColorToken(level: string): string {
  return isCompoundLevel(level) ? COMPOUND_LEVEL_STYLES[level].colorToken : "var(--muted-foreground)"
}
