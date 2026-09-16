import "server-only"

import daneProjections from "./data/dane-projections-2018-2026.json"
import { getMunicipioByCode } from "@/lib/lugares/registry"

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
  /**
   * False for a nationally-selected municipio that isn't one of the three
   * study-area municipalities: DANE's urbano/rural/sex breakdown is only
   * checked in for those three (the national series exists solely as a
   * multi-hundred-MB Excel workbook with no per-municipio API). Rather than
   * fabricate figures, every value is zeroed and the UI shows "sin datos".
   */
  hasData: boolean
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

type DaneEntry = { codigoMunicipio: string; years: Record<string, YearPopulation> }
const DANE_MUNICIPIOS = daneProjections.municipios as Record<string, DaneEntry>

/** Study-area municipios indexed by DIVIPOLA code, for selection-aware lookup. */
const STUDY_AREA_BY_CODE = new Map(
  MUNICIPIOS.map((name) => [DANE_MUNICIPIOS[name].codigoMunicipio, name] as const),
)

const EMPTY_YEAR: YearPopulation = { urbano: 0, rural: 0, hombres: 0, mujeres: 0, total: 0 }

function buildFromDane(name: string, latestYear: AvailableYear): MunicipioPopulation {
  const entry = DANE_MUNICIPIOS[name]
  const years = Object.fromEntries(
    AVAILABLE_YEARS.map((y) => [y, entry.years[String(y)]]),
  ) as Record<AvailableYear, YearPopulation>
  const latest = years[latestYear]
  return {
    municipio: name,
    codigoMunicipio: entry.codigoMunicipio,
    hasData: true,
    year: latestYear,
    urbano: latest.urbano,
    rural: latest.rural,
    hombres: latest.hombres,
    mujeres: latest.mujeres,
    total: latest.total,
    years,
  }
}

function buildEmpty(code: string, latestYear: AvailableYear): MunicipioPopulation {
  const years = Object.fromEntries(AVAILABLE_YEARS.map((y) => [y, EMPTY_YEAR])) as Record<
    AvailableYear,
    YearPopulation
  >
  return {
    municipio: getMunicipioByCode(code)?.name ?? code,
    codigoMunicipio: code,
    hasData: false,
    year: latestYear,
    urbano: 0,
    rural: 0,
    hombres: 0,
    mujeres: 0,
    total: 0,
    years,
  }
}

/**
 * Reads normalized population for the requested municipios. With no codes
 * (the default), returns the three study-area municipalities' full DANE
 * breakdown. With codes, returns DANE data for any that are study-area
 * municipios and an honest `hasData: false` placeholder for the rest, so a
 * nationally-selected municipio never shows fabricated or borrowed figures.
 */
export async function getMunicipioPopulations(municipioCodes?: string[]): Promise<MunicipioPopulation[]> {
  const latestYear = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]

  if (!municipioCodes || municipioCodes.length === 0) {
    return MUNICIPIOS.map((name) => buildFromDane(name, latestYear))
  }

  return municipioCodes.map((code) => {
    const studyName = STUDY_AREA_BY_CODE.get(code)
    return studyName ? buildFromDane(studyName, latestYear) : buildEmpty(code, latestYear)
  })
}
