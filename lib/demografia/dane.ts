import "server-only"

/**
 * DANE municipal population, sourced live from the open dataset
 * "Distribución Poblacional Del Valle Del Cauca" on datos.gov.co
 * (Socrata resource 4wbc-urmu). It carries urban/rural and sex splits by
 * municipality for 2018-2020; 2020 is the most recent year published.
 */

const RESOURCE_URL = "https://www.datos.gov.co/resource/4wbc-urmu.json"

export const MUNICIPIOS = ["Sevilla", "Caicedonia", "Zarzal"] as const

export interface MunicipioPopulation {
  municipio: string
  codigoMunicipio: string
  /** Year the urbano/rural/hombres/mujeres figures correspond to. */
  year: number
  urbano: number
  rural: number
  hombres: number
  mujeres: number
  total: number
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

function emptyPopulation(municipio: string): MunicipioPopulation {
  return {
    municipio,
    codigoMunicipio: "",
    year: 0,
    urbano: 0,
    rural: 0,
    hombres: 0,
    mujeres: 0,
    total: 0,
  }
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

    const urbano = toNumber(row._2020_urbano)
    const rural = toNumber(row._2020_rural)
    const hombres = toNumber(row.hombre_2020)
    const mujeres = toNumber(row.mujer_2020)

    return {
      municipio: name,
      codigoMunicipio: row.codigo_municipio ?? "",
      year: 2020,
      urbano,
      rural,
      hombres,
      mujeres,
      total: urbano + rural,
    }
  })
}
