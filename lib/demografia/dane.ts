import "server-only"

import daneProjections from "./data/dane-projections-national.json"
import { getMunicipioByCode, DEFAULT_MUNICIPIO_CODE } from "@/lib/lugares/registry"

/**
 * DANE municipal population for every municipality in Colombia.
 *
 * Source: DANE's official "Proyecciones de población municipal por área,
 * sexo y edad" workbook (CNPV 2018, post-COVID-19 update), which covers
 * 2020-2035 for all 1,122 municipios. DANE publishes it only as a single
 * ~70 MB national Excel workbook with no per-municipio API, so it was
 * downloaded once and reduced — server-side, at build time — to the compact
 * per-municipio urbano/rural/hombres/mujeres/total series checked in at
 * ./data/dane-projections-national.json. This module reads that JSON: no
 * network call, no staleness risk, and real figures for any municipio the
 * user selects rather than the three-municipio study-area extract this
 * previously shipped.
 *
 * To refresh when DANE republishes: re-run the extraction (download the
 * workbook at DANE_SOURCE_URL, sum the per-sex age columns — Hombres and
 * Mujeres — per municipio/year for the Cabecera, Centros Poblados y Rural
 * Disperso, and Total area rows) and overwrite the JSON.
 */

export const DANE_SOURCE = daneProjections.source
export const DANE_SOURCE_URL = daneProjections.sourceUrl

/** Years extracted from the DANE projections workbook (2020-2035). */
export const AVAILABLE_YEARS = daneProjections.extractedYears.map((y) => Number(y)) as readonly number[]
export type AvailableYear = number

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
   * True whenever DANE has a series for this municipio — i.e. every real
   * DIVIPOLA municipio. Kept as a field (rather than assumed) so the UI can
   * still show an honest placeholder for an unknown/invalid code instead of
   * fabricated figures.
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

type DaneEntry = { nombre: string; years: Record<string, YearPopulation> }
const DANE_MUNICIPIOS = daneProjections.municipios as Record<string, DaneEntry>

const LATEST_YEAR = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]
const EMPTY_YEAR: YearPopulation = { urbano: 0, rural: 0, hombres: 0, mujeres: 0, total: 0 }

function buildFromDane(code: string, entry: DaneEntry): MunicipioPopulation {
  const years = Object.fromEntries(
    AVAILABLE_YEARS.map((y) => [y, entry.years[String(y)] ?? EMPTY_YEAR]),
  ) as Record<AvailableYear, YearPopulation>
  const latest = years[LATEST_YEAR]
  return {
    municipio: getMunicipioByCode(code)?.name ?? entry.nombre,
    codigoMunicipio: code,
    hasData: true,
    year: LATEST_YEAR,
    urbano: latest.urbano,
    rural: latest.rural,
    hombres: latest.hombres,
    mujeres: latest.mujeres,
    total: latest.total,
    years,
  }
}

function buildEmpty(code: string): MunicipioPopulation {
  const years = Object.fromEntries(AVAILABLE_YEARS.map((y) => [y, EMPTY_YEAR])) as Record<
    AvailableYear,
    YearPopulation
  >
  return {
    municipio: getMunicipioByCode(code)?.name ?? code,
    codigoMunicipio: code,
    hasData: false,
    year: LATEST_YEAR,
    urbano: 0,
    rural: 0,
    hombres: 0,
    mujeres: 0,
    total: 0,
    years,
  }
}

/**
 * Reads normalized DANE population for the requested municipios. With no
 * codes it defaults to Sevilla (the app's home municipio). Every real
 * DIVIPOLA code resolves to its full urbano/rural/hombres/mujeres series;
 * an unknown code falls back to an honest `hasData: false` placeholder.
 */
export async function getMunicipioPopulations(municipioCodes?: string[]): Promise<MunicipioPopulation[]> {
  const codes = municipioCodes && municipioCodes.length > 0 ? municipioCodes : [DEFAULT_MUNICIPIO_CODE]

  return codes.map((code) => {
    const entry = DANE_MUNICIPIOS[code]
    return entry ? buildFromDane(code, entry) : buildEmpty(code)
  })
}
