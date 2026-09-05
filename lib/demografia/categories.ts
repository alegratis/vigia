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

export interface DemografiaCategory {
  key: DemografiaCategoryKey
  label: string
  /** Background utility class for the identity color, e.g. filter swatches and metric cards. */
  swatchClass: string
  /** Foreground utility class with guaranteed contrast against swatchClass. */
  foregroundClass: string
}

export const DEMOGRAFIA_CATEGORIES: readonly DemografiaCategory[] = [
  {
    key: "urbano",
    label: "Urbano",
    swatchClass: "bg-demografia-urbano",
    foregroundClass: "text-demografia-urbano-foreground",
  },
  {
    key: "rural",
    label: "Rural",
    swatchClass: "bg-demografia-rural",
    foregroundClass: "text-demografia-rural-foreground",
  },
  {
    key: "hombres",
    label: "Hombres",
    swatchClass: "bg-demografia-hombres",
    foregroundClass: "text-demografia-hombres-foreground",
  },
  {
    key: "mujeres",
    label: "Mujeres",
    swatchClass: "bg-demografia-mujeres",
    foregroundClass: "text-demografia-mujeres-foreground",
  },
]

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
