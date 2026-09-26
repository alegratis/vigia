/**
 * Shared, client-safe 5-tier scale + min-max normalization for the
 * Demografía tab's DANE geoportal indicators (pobreza multidimensional,
 * viviendas/hogares/personas) — mirrors `lib/sismologia/levels.ts`'s
 * exposure-tier pattern, but keyed to each indicator's own min/max range
 * (computed client-side from the loaded features) rather than a fixed 0–1
 * score, since IPM % and manzana population counts have very different
 * native ranges. No server imports.
 */

export const INDICATOR_LEVELS = ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto"] as const
export type IndicatorLevel = (typeof INDICATOR_LEVELS)[number]

export const INDICATOR_LEVEL_TOKENS: Record<IndicatorLevel, string> = {
  "Muy bajo": "var(--demografia-indicador-muy-bajo)",
  Bajo: "var(--demografia-indicador-bajo)",
  Moderado: "var(--demografia-indicador-moderado)",
  Alto: "var(--demografia-indicador-alto)",
  "Muy alto": "var(--demografia-indicador-muy-alto)",
}

/** Normalizes `value` into [0, 1] given the observed `min`/`max` across the active feature set. */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

/** Maps a 0–1 normalized value onto the shared 5-tier scale (same cutoffs as the compound-risk model). */
export function indicatorLevel(normalized: number): IndicatorLevel {
  if (normalized < 0.2) return "Muy bajo"
  if (normalized < 0.4) return "Bajo"
  if (normalized < 0.6) return "Moderado"
  if (normalized < 0.8) return "Alto"
  return "Muy alto"
}

/** Raw CSS color token for a 0–1 normalized value. */
export function indicatorColorToken(normalized: number): string {
  return INDICATOR_LEVEL_TOKENS[indicatorLevel(normalized)]
}

/** Extrusion height (meters) for a 0–1 normalized value — same clamp-and-scale shape as the sismología damage columns. */
export function indicatorHeight(normalized: number, maxHeightMeters = 1400): number {
  return Math.max(60, normalized * maxHeightMeters)
}
