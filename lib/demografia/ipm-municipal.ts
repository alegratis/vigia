/**
 * IPM municipal de fuente censal (DANE, Censo Nacional de Población y Vivienda 2018) para los cuatro
 * municipios de estudio, con el desglose por cabecera y por centros poblados y rural disperso, y las
 * 15 privaciones que lo componen. Es un dato censal fijo: vive en un JSON del proyecto
 * (scripts/dane/extract-ipm-municipal.py lo regenera) y no depende de ninguna red en tiempo de
 * ejecución. Sin imports de servidor: lo usan tanto el cliente como el servidor.
 */

import raw from "./data/ipm-municipal-2018.json"

export interface IpmValor {
  total: number | null
  cabeceras: number | null
  rural: number | null
}

export interface IpmMunicipalEntry {
  codigo: string
  municipio: string
  ipm: IpmValor
  privaciones: Record<string, IpmValor>
}

interface IpmMunicipalData {
  fuente: string
  fuenteUrl: string
  anio: number
  municipios: Record<string, IpmMunicipalEntry>
}

export const IPM_MUNICIPAL = raw as IpmMunicipalData

export type IpmDominio = "cabecera" | "rural"

export interface IpmVeredaValue {
  municipio: string
  dominio: IpmDominio
  /** IPM (%) del dominio de esta vereda: cabecera para el casco urbano, rural para el resto. */
  ipm: number
  /** IPM (%) del municipio completo. */
  ipmMunicipal: number
  /** Las privaciones más altas del dominio, de mayor a menor. */
  privaciones: { nombre: string; valor: number }[]
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const BY_NAME = new Map(Object.values(IPM_MUNICIPAL.municipios).map((entry) => [fold(entry.municipio), entry]))

/**
 * Valor de IPM que le corresponde a una vereda: el de la cabecera si es un casco urbano y el de
 * centros poblados y rural disperso en cualquier otro caso. `null` si el municipio no está cubierto.
 */
export function ipmForVereda(municipio: string, esCascoUrbano: boolean, topPrivaciones = 3): IpmVeredaValue | null {
  const entry = BY_NAME.get(fold(municipio))
  if (!entry) return null

  const dominio: IpmDominio = esCascoUrbano ? "cabecera" : "rural"
  const key = esCascoUrbano ? "cabeceras" : "rural"
  const ipm = entry.ipm[key]
  if (ipm == null || entry.ipm.total == null) return null

  const privaciones = Object.entries(entry.privaciones)
    .flatMap(([nombre, valores]) => (valores[key] == null ? [] : [{ nombre, valor: valores[key] as number }]))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, topPrivaciones)

  return { municipio: entry.municipio, dominio, ipm, ipmMunicipal: entry.ipm.total, privaciones }
}
