/**
 * Shared, client-safe metadata for the precipitación threat levels computed
 * in lib/precipitacion/power-client.ts from accumulated rainfall. No
 * official Colombian standard defines fixed mm thresholds for this
 * (IDEAM's own guidance uses qualitative categories tied to region-specific
 * IDF curves, not a single national scale) — these bands are a simple,
 * disclosed heuristic derived from the WMO/AMS glossary's daily
 * rainfall-intensity bands (light/moderate/heavy/violent, roughly <2.5,
 * 2.5–7.6, 7.6–50 and >50 mm in 24h) scaled to this app's 7-day
 * accumulation window. They are context, not a calibrated flood or
 * landslide hazard model — see lib/precipitacion/power-client.ts.
 */

export const PRECIPITATION_LEVELS = ["Bajo", "Moderado", "Alto", "Muy alto"] as const
export type PrecipitationLevel = (typeof PRECIPITATION_LEVELS)[number]

/** Upper bound (mm, exclusive) of accumulated 7-day rainfall for each level; the last has none. */
const LEVEL_THRESHOLDS_MM: Record<PrecipitationLevel, number | null> = {
  Bajo: 35,
  Moderado: 75,
  Alto: 150,
  "Muy alto": null,
}

export interface PrecipitationLevelStyle {
  label: PrecipitationLevel
  swatchClass: string
  colorToken: string
}

export const PRECIPITATION_LEVEL_STYLES: Record<PrecipitationLevel, PrecipitationLevelStyle> = {
  Bajo: {
    label: "Bajo",
    swatchClass: "bg-precipitacion-bajo",
    colorToken: "var(--precipitacion-bajo)",
  },
  Moderado: {
    label: "Moderado",
    swatchClass: "bg-precipitacion-moderado",
    colorToken: "var(--precipitacion-moderado)",
  },
  Alto: {
    label: "Alto",
    swatchClass: "bg-precipitacion-alto",
    colorToken: "var(--precipitacion-alto)",
  },
  "Muy alto": {
    label: "Muy alto",
    swatchClass: "bg-precipitacion-muy-alto",
    colorToken: "var(--precipitacion-muy-alto)",
  },
}

/** Classifies an accumulated 7-day rainfall total (mm) into one of the four levels above. */
export function classifyPrecipitation(accumulatedMm: number): PrecipitationLevel {
  for (const level of PRECIPITATION_LEVELS) {
    const upperBound = LEVEL_THRESHOLDS_MM[level]
    if (upperBound === null || accumulatedMm < upperBound) return level
  }
  return "Muy alto"
}

export function isPrecipitationLevel(value: string): value is PrecipitationLevel {
  return (PRECIPITATION_LEVELS as readonly string[]).includes(value)
}

/** Raw CSS color token for a level, falling back to a neutral tone for unrecognized values. */
export function precipitationLevelColorToken(level: string): string {
  return isPrecipitationLevel(level)
    ? PRECIPITATION_LEVEL_STYLES[level].colorToken
    : "var(--muted-foreground)"
}
