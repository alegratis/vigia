import municipiosData from "@/data/divipola/municipios.json"

/**
 * National place registry, sourced once from DANE's DIVIPOLA dataset on
 * datos.gov.co (resource gdxc-w37w) and checked in as
 * data/divipola/municipios.json — 1,122 municipios across 33 departamentos
 * (the 32 departamentos plus Bogotá D.C.), each with its official code,
 * name, department and centroid. This replaces the app's original hardcoded
 * three-municipio study area with a nationwide lookup so any municipio can
 * be selected and have its models loaded dynamically.
 *
 * Client-safe (no server-only import): the department/city dropdowns need it
 * in the browser, and the checked-in JSON is ~110 KB.
 */

export interface Municipio {
  /** 5-digit DIVIPOLA municipio code (department code + 3 digits). */
  code: string
  /** Title-case municipio name. */
  name: string
  /** 2-digit DIVIPOLA department code. */
  depCode: string
  /** Title-case department name. */
  dep: string
  /** Centroid latitude (WGS84). */
  lat: number
  /** Centroid longitude (WGS84). */
  lon: number
}

export interface Departamento {
  code: string
  name: string
}

export const MUNICIPIOS_ALL = municipiosData as Municipio[]

const MUNICIPIO_BY_CODE = new Map(MUNICIPIOS_ALL.map((m) => [m.code, m]))

export function getMunicipioByCode(code: string | null | undefined): Municipio | undefined {
  if (!code) return undefined
  return MUNICIPIO_BY_CODE.get(code)
}

/** Every departamento, de-duplicated from the municipio list, sorted by name. */
export const DEPARTAMENTOS: Departamento[] = [
  ...new Map(MUNICIPIOS_ALL.map((m) => [m.depCode, { code: m.depCode, name: m.dep }])).values(),
].sort((a, b) => a.name.localeCompare(b.name, "es"))

/** Municipios within a departamento, sorted by name. */
export function getMunicipiosByDepartamento(depCode: string): Municipio[] {
  return MUNICIPIOS_ALL.filter((m) => m.depCode === depCode).sort((a, b) => a.name.localeCompare(b.name, "es"))
}

/** Default single-municipio selection when none is chosen: Sevilla, Valle del Cauca. */
export const DEFAULT_MUNICIPIO_CODE = "76736"

/** DIVIPOLA codes of the original three-municipio study area (Caicedonia, Sevilla, Zarzal). */
export const STUDY_AREA_MUNICIPIO_CODES = ["76122", "76736", "76895"] as const

/** Valle del Cauca — the study area's departamento, pre-selected in the picker. */
export const STUDY_AREA_DEPARTAMENTO_CODE = "76"
