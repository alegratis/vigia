/**
 * Shared, client-safe constants for the demographics filters: the three
 * study-area municipalities, the years DANE publishes, and the four
 * urbano/rural/hombres/mujeres categories with their fixed identity colors
 * (each maps to a token defined in globals.css).
 */

export const MUNICIPIOS = ["Sevilla", "Caicedonia", "Zarzal"] as const

export const AVAILABLE_YEARS = [2018, 2019, 2020] as const
export type AvailableYear = (typeof AVAILABLE_YEARS)[number]

export type DemografiaCategoryKey = "urbano" | "rural" | "hombres" | "mujeres"

/**
 * The four categories are two independent, mutually exclusive partitions of
 * the same population (urbano+rural = 100%, hombres+mujeres = 100%), not
 * four comparable buckets. Every UI that lists them keeps that grouping
 * explicit — separate fieldsets, separate metric-card rows, separate chart
 * panels — so mixing them never reads as one flat, directly-comparable set.
 */
export type DemografiaCategoryGroup = "residencia" | "sexo"

export interface DemografiaCategoryGroupMeta {
  key: DemografiaCategoryGroup
  label: string
  hint: string
}

export const DEMOGRAFIA_CATEGORY_GROUPS: readonly DemografiaCategoryGroupMeta[] = [
  { key: "residencia", label: "Residencia", hint: "Urbano + rural suman el 100%" },
  { key: "sexo", label: "Sexo", hint: "Hombres + mujeres suman el 100%" },
]

export interface DemografiaCategory {
  key: DemografiaCategoryKey
  label: string
  group: DemografiaCategoryGroup
  /** Background utility class for the identity color, e.g. filter swatches and metric cards. */
  swatchClass: string
  /** Foreground utility class with guaranteed contrast against swatchClass. */
  foregroundClass: string
  /** Raw CSS color token, for accents that can't use Tailwind classes (chart fills, borders). */
  colorToken: string
}

export const DEMOGRAFIA_CATEGORIES: readonly DemografiaCategory[] = [
  {
    key: "urbano",
    label: "Urbano",
    group: "residencia",
    swatchClass: "bg-demografia-urbano",
    foregroundClass: "text-demografia-urbano-foreground",
    colorToken: "var(--demografia-urbano)",
  },
  {
    key: "rural",
    label: "Rural",
    group: "residencia",
    swatchClass: "bg-demografia-rural",
    foregroundClass: "text-demografia-rural-foreground",
    colorToken: "var(--demografia-rural)",
  },
  {
    key: "hombres",
    label: "Hombres",
    group: "sexo",
    swatchClass: "bg-demografia-hombres",
    foregroundClass: "text-demografia-hombres-foreground",
    colorToken: "var(--demografia-hombres)",
  },
  {
    key: "mujeres",
    label: "Mujeres",
    group: "sexo",
    swatchClass: "bg-demografia-mujeres",
    foregroundClass: "text-demografia-mujeres-foreground",
    colorToken: "var(--demografia-mujeres)",
  },
]

export function categoriesInGroup(group: DemografiaCategoryGroup): DemografiaCategory[] {
  return DEMOGRAFIA_CATEGORIES.filter((c) => c.group === group)
}

interface YearPopulationLike {
  urbano: number
  rural: number
  hombres: number
  mujeres: number
  total: number
}

interface MunicipioPopulationLike {
  years: Record<number, YearPopulationLike>
}

/** Reads a single category's value for a municipio at a given year. */
export function getCategoryValue(
  population: MunicipioPopulationLike,
  key: DemografiaCategoryKey,
  year: AvailableYear,
): number {
  return population.years[year]?.[key] ?? 0
}
