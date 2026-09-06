/**
 * Shared, client-safe metadata for the forest-fire threat levels
 * (`Amenaza_Label`) published in the `AmenazaIncendios` ArcGIS Online layer
 * (see lib/incendios/client.ts). Only four levels appear in the source data
 * across its whole coverage — there is no "Muy alto" tier, unlike the
 * five-level deslizamientos scale. No server imports.
 */

export const FIRE_THREAT_LEVELS = ["Muy bajo", "Bajo", "Medio", "Alto"] as const
export type FireThreatLevel = (typeof FIRE_THREAT_LEVELS)[number]

export interface FireThreatLevelStyle {
  label: FireThreatLevel
  /** Background utility class for swatches, e.g. legend dots and checkboxes. */
  swatchClass: string
  /** Raw CSS color token, for surfaces that can't use Tailwind classes (Leaflet SVG paths). */
  colorToken: string
}

export const FIRE_THREAT_LEVEL_STYLES: Record<FireThreatLevel, FireThreatLevelStyle> = {
  "Muy bajo": {
    label: "Muy bajo",
    swatchClass: "bg-incendios-muy-bajo",
    colorToken: "var(--incendios-muy-bajo)",
  },
  Bajo: {
    label: "Bajo",
    swatchClass: "bg-incendios-bajo",
    colorToken: "var(--incendios-bajo)",
  },
  Medio: {
    label: "Medio",
    swatchClass: "bg-incendios-medio",
    colorToken: "var(--incendios-medio)",
  },
  Alto: {
    label: "Alto",
    swatchClass: "bg-incendios-alto",
    colorToken: "var(--incendios-alto)",
  },
}

export function isFireThreatLevel(value: string): value is FireThreatLevel {
  return (FIRE_THREAT_LEVELS as readonly string[]).includes(value)
}

/** Raw CSS color token for a level, falling back to a neutral tone for unrecognized values. */
export function fireLevelColorToken(level: string): string {
  return isFireThreatLevel(level)
    ? FIRE_THREAT_LEVEL_STYLES[level].colorToken
    : "var(--muted-foreground)"
}
