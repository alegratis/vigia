import "server-only"

import { FIRE_THREAT_LEVELS, type FireThreatLevel } from "./levels"

/**
 * Maps this app's own 0–1 fire-weather score (VPD + wind + dry-spell from
 * Open-Meteo — see lib/nwp/openmeteo-conditions.ts) onto the four-level
 * `AmenazaIncendios` vocabulary the published layer already uses, so the
 * computed model and the official polygons read on one shared color scale.
 *
 * This is a live meteorological signal — how fire-prone the atmosphere is
 * right now — distinct from the static published amenaza polygons (which
 * only cover Sevilla/Caicedonia). Computed at every vereda centroid, it
 * gives the incendios map a national, model-based hazard layer.
 */
export function fireWeatherLevelFromScore(score: number | null): FireThreatLevel | null {
  if (score == null) return null
  if (score < 0.25) return "Muy bajo"
  if (score < 0.5) return "Bajo"
  if (score < 0.75) return "Medio"
  return "Alto"
}

export { FIRE_THREAT_LEVELS }
export type { FireThreatLevel }
