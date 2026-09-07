/**
 * Shared, client-safe metadata for the landslide susceptibility levels
 * (`IS_nivel`) published in the `VIGIA_Amenaza_IS_Puntos`/`IS_Poligonos`
 * ArcGIS Online layers (see lib/deslizamientos/client.ts). No server
 * imports.
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

/**
 * The `VIGIA_Amenaza_IS_*` layers store `IS_nivel` as upper snake case
 * (`MUY_ALTO`, `ALTO`, `MEDIO`, `BAJO`, `MUY_BAJO`) rather than the title
 * case used throughout this app's UI and the older
 * `amenaza_por_deslizamiento` layer. Normalizing here keeps every
 * downstream consumer (map styling, legends, exposure panel) unaware of
 * the source layer's raw casing.
 */
const RAW_IS_NIVEL_TO_LEVEL: Record<string, SusceptibilityLevel> = {
  MUY_BAJO: "Muy bajo",
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
  MUY_ALTO: "Muy alto",
}

/** Normalizes a raw `IS_nivel` value from the source layer, or `null` if unrecognized. */
export function normalizeSusceptibilityLevel(value: string | null | undefined): SusceptibilityLevel | null {
  if (!value) return null
  if (isSusceptibilityLevel(value)) return value
  return RAW_IS_NIVEL_TO_LEVEL[value.trim().toUpperCase()] ?? null
}

/** Raw CSS color token for a level, falling back to a neutral tone for unrecognized values. */
export function levelColorToken(level: string): string {
  return isSusceptibilityLevel(level)
    ? SUSCEPTIBILITY_LEVEL_STYLES[level].colorToken
    : "var(--muted-foreground)"
}
