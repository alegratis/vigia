import "server-only"

import daneProjections from "./data/dane-projections-2018-2026.json"

/**
 * DANE municipal population for the three study-area municipalities.
 *
 * Previously this fetched the open dataset "Distribución Poblacional Del
 * Valle Del Cauca" on datos.gov.co (Socrata resource 4wbc-urmu) live. That
 * resource's rows were last updated in December 2021 and only ever
 * published urbano/rural/hombres/mujeres columns for 2018-2020 — refetching
 * it daily could never surface anything newer, it was simply frozen.
 *
 * DANE's own municipal population series is far more current (its
 * "Proyecciones y retroproyecciones de poblacion municipal" workbook, last
 * republished 2025-07-30, covers 2018-2042 using the post-2018-census
 * cohort-component model), but it is only published as a single ~930 MB
 * national Excel workbook with no per-municipality API. So this file was
 * downloaded once, and the Sevilla/Caicedonia/Zarzal rows through 2026 were
 * extracted into ./data/dane-projections-2018-2026.json, checked in below.
 * That JSON is what this module reads — no network call, no staleness risk
 * from an abandoned live endpoint.
 */

export const MUNICIPIOS = ["Sevilla", "Caicedonia", "Zarzal"] as const

export const DANE_SOURCE = daneProjections.source
export const DANE_SOURCE_URL = daneProjections.sourceUrl

/** Years extracted from the DANE projections workbook. */
export const AVAILABLE_YEARS = daneProjections.extractedYears.map((y) => Number(y)) as readonly number[]
export type AvailableYear = (typeof AVAILABLE_YEARS)[number]

export interface YearPopulation {
  urbano: number
  rural: number
  hombres: number
  mujeres: number
  total: number
}

export interface MunicipioPopulation {
  municipio: string
  codigoMunicipio: string
  /** Most recent year available; the top-level fields below mirror it. */
  year: AvailableYear
  urbano: number
  rural: number
  hombres: number
  mujeres: number
  total: number
  /** Full urbano/rural/hombres/mujeres breakdown for every extracted year. */
  years: Record<AvailableYear, YearPopulation>
}

/** Reads and normalizes population for the three study-area municipalities from the static dataset. */
export async function getMunicipioPopulations(): Promise<MunicipioPopulation[]> {
  const latestYear = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]

  return MUNICIPIOS.map((name) => {
    const entry = (daneProjections.municipios as Record<string, { codigoMunicipio: string; years: Record<string, YearPopulation> }>)[
      name
    ]

    const years = Object.fromEntries(
      AVAILABLE_YEARS.map((y) => [y, entry.years[String(y)]]),
    ) as Record<AvailableYear, YearPopulation>
    const latest = years[latestYear]

    return {
      municipio: name,
      codigoMunicipio: entry.codigoMunicipio,
      year: latestYear,
      urbano: latest.urbano,
      rural: latest.rural,
      hombres: latest.hombres,
      mujeres: latest.mujeres,
      total: latest.total,
      years,
    }
  })
}
