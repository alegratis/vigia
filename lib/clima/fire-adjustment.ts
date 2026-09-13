import { FIRE_THREAT_LEVELS, isFireThreatLevel } from "@/lib/incendios/levels"

/**
 * Derives a *dynamic* fire vulnerability by nudging the incendios map's
 * static structural threat label (a published ArcGIS polygon value — see
 * lib/incendios/client.ts, not an app-computed score) upward during a dry
 * spell. This deliberately does not touch the separate GWIS FWI raster the
 * incendios map overlays, so there is no double-counting of dryness: the
 * static label encodes fixed structural susceptibility (fuel, slope, land
 * cover), and this adds the one thing that label can't — how dry it is
 * right now, from the live forecast.
 *
 * The adjustment is intentionally conservative: a single-tier bump, capped
 * at the scale's top level ("Alto"), only when the dry spell is long enough
 * to matter. It stays out of the app's compound-risk model (that still uses
 * the five calibrated hazards) and is surfaced only on the clima map as a
 * clearly model-derived, illustrative figure.
 */

/** Consecutive dry forecast days (from day 0) needed to raise fire vulnerability one tier. */
export const DRY_SPELL_BUMP_DAYS = 5

/** Counts leading dry days: how many days from the start of the forecast are dry before the first wet day. */
export function countRachaSeca(secoFlags: boolean[]): number {
  let count = 0
  for (const seco of secoFlags) {
    if (!seco) break
    count++
  }
  return count
}

/**
 * Blends a static base fire label with the current dry-spell length. Returns
 * the base unchanged (and `elevado: false`) when there is no recognizable
 * base label — Zarzal, outside the incendios layer's coverage, stays null.
 */
export function adjustFireThreat(
  base: string | null,
  rachaSeca: number,
): { ajustada: string | null; elevado: boolean } {
  if (!base || !isFireThreatLevel(base)) return { ajustada: base ?? null, elevado: false }
  const index = FIRE_THREAT_LEVELS.indexOf(base)
  const canBump = index >= 0 && index < FIRE_THREAT_LEVELS.length - 1
  if (rachaSeca >= DRY_SPELL_BUMP_DAYS && canBump) {
    return { ajustada: FIRE_THREAT_LEVELS[index + 1], elevado: true }
  }
  return { ajustada: base, elevado: false }
}
