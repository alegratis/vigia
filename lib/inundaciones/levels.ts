/**
 * Shared, client-safe metadata for the flood-susceptibility levels
 * (`descripcio`) published in the `susceptibilidad_inundaciones` ArcGIS
 * Online layer (see lib/inundaciones/client.ts). This is a static hazard
 * zoning — where flooding is structurally more likely — distinct from the
 * live, dynamic GEOGLOWS river forecast already shown on the same map. No
 * server imports.
 */

export const FLOOD_SUSCEPTIBILITY_LEVELS = ["Muy alta", "Alta", "Moderada", "Baja", "Muy baja"] as const
export type FloodSusceptibilityLevel = (typeof FLOOD_SUSCEPTIBILITY_LEVELS)[number]

export interface FloodSusceptibilityLevelStyle {
  label: FloodSusceptibilityLevel
  /** Background utility class for swatches, e.g. legend dots and checkboxes. */
  swatchClass: string
  /** Raw CSS color token, for surfaces that can't use Tailwind classes (Leaflet SVG paths). */
  colorToken: string
}

export const FLOOD_SUSCEPTIBILITY_LEVEL_STYLES: Record<
  FloodSusceptibilityLevel,
  FloodSusceptibilityLevelStyle
> = {
  "Muy alta": {
    label: "Muy alta",
    swatchClass: "bg-inundaciones-muy-alta",
    colorToken: "var(--inundaciones-muy-alta)",
  },
  Alta: {
    label: "Alta",
    swatchClass: "bg-inundaciones-alta",
    colorToken: "var(--inundaciones-alta)",
  },
  Moderada: {
    label: "Moderada",
    swatchClass: "bg-inundaciones-moderada",
    colorToken: "var(--inundaciones-moderada)",
  },
  Baja: {
    label: "Baja",
    swatchClass: "bg-inundaciones-baja",
    colorToken: "var(--inundaciones-baja)",
  },
  "Muy baja": {
    label: "Muy baja",
    swatchClass: "bg-inundaciones-muy-baja",
    colorToken: "var(--inundaciones-muy-baja)",
  },
}

export function isFloodSusceptibilityLevel(value: string): value is FloodSusceptibilityLevel {
  return (FLOOD_SUSCEPTIBILITY_LEVELS as readonly string[]).includes(value)
}

/** Raw CSS color token for a level, falling back to a neutral tone for unrecognized values. */
export function floodSusceptibilityColorToken(level: string): string {
  return isFloodSusceptibilityLevel(level)
    ? FLOOD_SUSCEPTIBILITY_LEVEL_STYLES[level].colorToken
    : "var(--muted-foreground)"
}
