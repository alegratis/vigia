/**
 * Shared, client-safe color scale for the "Índice de vulnerabilidad
 * compuesto" (combined vulnerability score) layer. Deliberately its own
 * teal ramp — distinct from both the sismología magnitude ramp (blue,
 * lib/sismologia/levels.ts) and the riesgo-compuesto ramp (violet/magenta,
 * lib/riesgo-compuesto/levels.ts) it's built from, so the three categories
 * never read as the same color on the map or in the category rail. Same
 * 5-tier vocabulary and 0-4 quintile cutoffs as
 * lib/vulnerabilidad/combined-score.ts's `vulnerabilityLevelFromScore`.
 * No server imports.
 */

import { VULNERABILITY_LEVELS, type VulnerabilityLevel } from "./combined-score"

export { VULNERABILITY_LEVELS }
export type { VulnerabilityLevel }

export interface VulnerabilityLevelStyle {
  label: VulnerabilityLevel
  swatchClass: string
  colorToken: string
}

export const VULNERABILITY_LEVEL_STYLES: Record<VulnerabilityLevel, VulnerabilityLevelStyle> = {
  "Muy bajo": {
    label: "Muy bajo",
    swatchClass: "bg-vulnerabilidad-muy-bajo",
    colorToken: "var(--vulnerabilidad-muy-bajo)",
  },
  Bajo: {
    label: "Bajo",
    swatchClass: "bg-vulnerabilidad-bajo",
    colorToken: "var(--vulnerabilidad-bajo)",
  },
  Moderado: {
    label: "Moderado",
    swatchClass: "bg-vulnerabilidad-moderado",
    colorToken: "var(--vulnerabilidad-moderado)",
  },
  Alto: {
    label: "Alto",
    swatchClass: "bg-vulnerabilidad-alto",
    colorToken: "var(--vulnerabilidad-alto)",
  },
  "Muy alto": {
    label: "Muy alto",
    swatchClass: "bg-vulnerabilidad-muy-alto",
    colorToken: "var(--vulnerabilidad-muy-alto)",
  },
}

/** Raw CSS color token for a vulnerability level, falling back to a neutral tone for unrecognized values. */
export function vulnerabilityLevelColorToken(level: string | null | undefined): string {
  return level != null && level in VULNERABILITY_LEVEL_STYLES
    ? VULNERABILITY_LEVEL_STYLES[level as VulnerabilityLevel].colorToken
    : "var(--muted-foreground)"
}
