/**
 * Shared, client-safe magnitude tiers for the sismología category, mirroring
 * `lib/incendios/levels.ts`'s pattern. Cutoffs follow the standard seismological
 * magnitude classes (USGS "Earthquake magnitude scale"): Micro (<3, rarely felt),
 * Menor (3–4, felt but rarely damaging), Ligero (4–5, minor damage possible),
 * Moderado (5–6, damage in populated areas), Fuerte (6+, serious damage) —
 * not an invented scale. No server imports.
 */

export const SEISMIC_MAGNITUDE_LEVELS = ["Micro", "Menor", "Ligero", "Moderado", "Fuerte"] as const
export type SeismicMagnitudeLevel = (typeof SEISMIC_MAGNITUDE_LEVELS)[number]

export interface SeismicMagnitudeLevelStyle {
  label: SeismicMagnitudeLevel
  range: string
  swatchClass: string
  colorToken: string
}

export const SEISMIC_MAGNITUDE_LEVEL_STYLES: Record<SeismicMagnitudeLevel, SeismicMagnitudeLevelStyle> = {
  Micro: {
    label: "Micro",
    range: "< 3.0",
    swatchClass: "bg-sismologia-micro",
    colorToken: "var(--sismologia-micro)",
  },
  Menor: {
    label: "Menor",
    range: "3.0 – 3.9",
    swatchClass: "bg-sismologia-menor",
    colorToken: "var(--sismologia-menor)",
  },
  Ligero: {
    label: "Ligero",
    range: "4.0 – 4.9",
    swatchClass: "bg-sismologia-ligero",
    colorToken: "var(--sismologia-ligero)",
  },
  Moderado: {
    label: "Moderado",
    range: "5.0 – 5.9",
    swatchClass: "bg-sismologia-moderado",
    colorToken: "var(--sismologia-moderado)",
  },
  Fuerte: {
    label: "Fuerte",
    range: "≥ 6.0",
    swatchClass: "bg-sismologia-fuerte",
    colorToken: "var(--sismologia-fuerte)",
  },
}

export function magnitudeLevel(magnitude: number): SeismicMagnitudeLevel {
  if (magnitude < 3) return "Micro"
  if (magnitude < 4) return "Menor"
  if (magnitude < 5) return "Ligero"
  if (magnitude < 6) return "Moderado"
  return "Fuerte"
}

export function isSeismicMagnitudeLevel(value: string): value is SeismicMagnitudeLevel {
  return (SEISMIC_MAGNITUDE_LEVELS as readonly string[]).includes(value)
}

/** Raw CSS color token for a magnitude, falling back to a neutral tone for unrecognized values. */
export function magnitudeColorToken(magnitude: number): string {
  return SEISMIC_MAGNITUDE_LEVEL_STYLES[magnitudeLevel(magnitude)].colorToken
}

/** Marker radius (px) scaled by magnitude — same clamp-and-scale technique as `fireRadius()` in the incendios map. */
export function magnitudeRadius(magnitude: number): number {
  return Math.min(16, Math.max(4, 3 + magnitude * 1.8))
}
