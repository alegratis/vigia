/**
 * Canonical severity buckets for Sevilla's community damage-report survey
 * (`estado_de_la_vivienda_tras_el_s` — see lib/sismologia/survey-damage.ts).
 * The raw field is free text from Survey123, so this classifies it into the
 * three severity levels the survey is designed around: total loss, structural
 * damage, and cosmetic-only damage. No server imports.
 */

export const DAMAGE_LEVELS = ["destruida", "danada", "posible"] as const
export type DamageLevel = (typeof DAMAGE_LEVELS)[number]

/** Ordered from least to most severe — matches the 3D column stacking order on the map. */
export const DAMAGE_LEVEL_ORDER: DamageLevel[] = ["posible", "danada", "destruida"]

export const DAMAGE_LEVEL_LABEL: Record<DamageLevel, string> = {
  destruida: "Destruida",
  danada: "Dañada (estructural)",
  posible: "Posiblemente dañada (cosmético)",
}

export const DAMAGE_LEVEL_COLOR_TOKEN: Record<DamageLevel, string> = {
  destruida: "var(--danos-destruida)",
  danada: "var(--danos-danada)",
  posible: "var(--danos-posible)",
}

/**
 * Buckets a raw `estado_de_la_vivienda_tras_el_s` survey value into one of
 * the three canonical severity levels. Matches by substring so it tolerates
 * the exact wording/casing/accents Survey123 stored, without needing to
 * hardcode the literal string. Returns `null` for empty/unrecognized values
 * (surfaced separately as "Sin especificar", never silently dropped).
 */
export function classifyDamageEstado(raw: string | null): DamageLevel | null {
  if (!raw) return null
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (dañada -> danada)
  if (normalized.includes("destru")) return "destruida"
  if (normalized.includes("posible")) return "posible"
  if (normalized.includes("dan")) return "danada"
  return null
}
