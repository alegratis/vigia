import "server-only"

/**
 * DANE municipal population, sourced live from the open dataset
 * "Distribución Poblacional Del Valle Del Cauca" on datos.gov.co
 * (Socrata resource 4wbc-urmu). It carries urban/rural and sex splits by
 * municipality for 2018-2020; 2020 is the most recent year published.
 */

const RESOURCE_URL = "https://www.datos.gov.co/resource/4wbc-urmu.json"

export const MUNICIPIOS = ["Sevilla", "Caicedonia", "Zarzal"] as const

/** Years the dataset publishes urbano/rural/hombres/mujeres splits for. */
export const AVAILABLE_YEARS = [2018, 2019, 2020] as const
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
  /** Full urbano/rural/hombres/mujeres breakdown for every published year. */
  years: Record<AvailableYear, YearPopulation>
}

export class DaneRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DaneRequestError"
  }
}

function toNumber(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(n) ? n : 0
}

function emptyYearPopulation(): YearPopulation {
  return { urbano: 0, rural: 0, hombres: 0, mujeres: 0, total: 0 }
}

function emptyPopulation(municipio: string): MunicipioPopulation {
  const years = Object.fromEntries(
    AVAILABLE_YEARS.map((y) => [y, emptyYearPopulation()]),
  ) as Record<AvailableYear, YearPopulation>
  return {
    municipio,
    codigoMunicipio: "",
    year: AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1],
    urbano: 0,
    rural: 0,
    hombres: 0,
    mujeres: 0,
    total: 0,
    years,
  }
}

/**
 * The Socrata resource names its columns inconsistently across years
 * (`urbano_2018` / `urbano_2019` vs `_2020_urbano`), so each year maps its
 * own field names explicitly rather than templating a single pattern.
 */
function readYear(row: Record<string, string>, year: AvailableYear): YearPopulation {
  const fieldsByYear: Record<AvailableYear, [string, string, string, string]> = {
    2018: ["urbano_2018", "rural_2018", "hombre_2018", "mujer_2018"],
    2019: ["urbano_2019", "rural_2019", "hombre_2019", "mujer_2019"],
    2020: ["_2020_urbano", "_2020_rural", "hombre_2020", "mujer_2020"],
  }
  const [urbanoField, ruralField, hombresField, mujeresField] = fieldsByYear[year]
  const urbano = toNumber(row[urbanoField])
  const rural = toNumber(row[ruralField])
  const hombres = toNumber(row[hombresField])
  const mujeres = toNumber(row[mujeresField])
  return { urbano, rural, hombres, mujeres, total: urbano + rural }
}

/** Fetch and normalize population for the three study-area municipalities. */
export async function getMunicipioPopulations(): Promise<MunicipioPopulation[]> {
  const url = new URL(RESOURCE_URL)
  url.searchParams.set(
    "$where",
    `municipio in (${MUNICIPIOS.map((m) => `'${m}'`).join(",")})`,
  )

  const res = await fetch(url, {
    // DANE's Socrata dataset changes rarely; refresh once a day.
    next: { revalidate: 60 * 60 * 24 },
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    throw new DaneRequestError(`datos.gov.co respondió ${res.status}`)
  }

  const rows = (await res.json()) as Record<string, string>[]

  return MUNICIPIOS.map((name) => {
    const row = rows.find((r) => r.municipio?.toLowerCase() === name.toLowerCase())
    if (!row) return emptyPopulation(name)

    const years = Object.fromEntries(
      AVAILABLE_YEARS.map((y) => [y, readYear(row, y)]),
    ) as Record<AvailableYear, YearPopulation>
    const latestYear = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]
    const latest = years[latestYear]

    return {
      municipio: name,
      codigoMunicipio: row.codigo_municipio ?? "",
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
