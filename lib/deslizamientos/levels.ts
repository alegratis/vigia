/**
 * Shared, client-safe metadata for the landslide susceptibility levels
 * (`IS_nivel`) published in the `amenaza_por_deslizamiento` ArcGIS Online
 * layer (see lib/deslizamientos/client.ts). No server imports.
 */

export const SUSCEPTIBILITY_LEVELS = ["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"] as const
export type SusceptibilityLevel = (typeof SUSCEPTIBILITY_LEVELS)[number]

export interface SusceptibilityLevelStyle {
  label: SusceptibilityLevel
  /** Background utility class for swatches, e.g. legend dots and checkboxes. */
  swatchClass: string
  /** Raw CSS color token, for surfaces that can't use Tailwind classes (Leaflet SVG paths). */
  colorToken: string
}

export const SUSCEPTIBILITY_LEVEL_STYLES: Record<SusceptibilityLevel, SusceptibilityLevelStyle> = {
  "Muy bajo": {
    label: "Muy bajo",
    swatchClass: "bg-deslizamientos-muy-bajo",
    colorToken: "var(--deslizamientos-muy-bajo)",
  },
  Bajo: {
    label: "Bajo",
    swatchClass: "bg-deslizamientos-bajo",
    colorToken: "var(--deslizamientos-bajo)",
  },
  Medio: {
    label: "Medio",
    swatchClass: "bg-deslizamientos-medio",
    colorToken: "var(--deslizamientos-medio)",
  },
  Alto: {
    label: "Alto",
    swatchClass: "bg-deslizamientos-alto",
    colorToken: "var(--deslizamientos-alto)",
  },
  "Muy alto": {
    label: "Muy alto",
    swatchClass: "bg-deslizamientos-muy-alto",
    colorToken: "var(--deslizamientos-muy-alto)",
  },
}

export function isSusceptibilityLevel(value: string): value is SusceptibilityLevel {
  return (SUSCEPTIBILITY_LEVELS as readonly string[]).includes(value)
}

/** Raw CSS color token for a level, falling back to a neutral tone for unrecognized values. */
export function levelColorToken(level: string): string {
  return isSusceptibilityLevel(level)
    ? SUSCEPTIBILITY_LEVEL_STYLES[level].colorToken
    : "var(--muted-foreground)"
}
