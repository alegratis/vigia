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

/**
 * Per-vereda seismic **exposure** tiers — distinct from the magnitude tiers
 * above, which classify a single quake. Exposure is the 0–1 distance-decay
 * score from lib/sismologia/exposure-score.ts (combining every nearby
 * epicenter), and drives the vereda choropleth fill on the sismología map —
 * the same way the deslizamientos and inundaciones maps shade their veredas
 * by their own models. It reuses the app-wide 0.2/0.4/0.6/0.8 score cutoffs
 * and the same 5-tier vocabulary as the compound-risk model
 * (lib/riesgo-compuesto/levels.ts), colored with the sismología magnitude
 * ramp so the whole category reads as one palette.
 */
export const SEISMIC_EXPOSURE_LEVELS = ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto"] as const
export type SeismicExposureLevel = (typeof SEISMIC_EXPOSURE_LEVELS)[number]

export const SEISMIC_EXPOSURE_LEVEL_TOKENS: Record<SeismicExposureLevel, string> = {
  "Muy bajo": "var(--sismologia-micro)",
  Bajo: "var(--sismologia-menor)",
  Moderado: "var(--sismologia-ligero)",
  Alto: "var(--sismologia-moderado)",
  "Muy alto": "var(--sismologia-fuerte)",
}

/** Maps a 0–1 exposure score onto the shared 5-tier scale (same cutoffs as `compoundLevelFromScore`). */
export function seismicExposureLevel(score: number): SeismicExposureLevel {
  if (score < 0.2) return "Muy bajo"
  if (score < 0.4) return "Bajo"
  if (score < 0.6) return "Moderado"
  if (score < 0.8) return "Alto"
  return "Muy alto"
}

/** Raw CSS color token for an exposure score, falling back to a neutral tone when the score is unavailable. */
export function seismicExposureColorToken(score: number | null | undefined): string {
  if (score == null) return "var(--muted-foreground)"
  return SEISMIC_EXPOSURE_LEVEL_TOKENS[seismicExposureLevel(score)]
}
