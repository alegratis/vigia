/** Client-safe response shapes for /api/demografia. No server imports. */

import type { FloodLevelKey } from "@/lib/geoglows/flood"

export interface YearPopulationView {
  urbano: number
  rural: number
  hombres: number
  mujeres: number
  total: number
}

export interface MunicipioPopulationView {
  municipio: string
  codigoMunicipio: string
  year: number
  urbano: number
  rural: number
  hombres: number
  mujeres: number
  total: number
  years: Record<number, YearPopulationView>
}

export interface MunicipioExposureView {
  municipio: string
  population: MunicipioPopulationView
  flood: { worstLevel: FloodLevelKey; stationCount: number } | null
  fire: { count: number; highConfidence: number } | null
}

export interface DemografiaResponse {
  department: string
  generatedAt: string
  municipios: MunicipioExposureView[]
  floodError: string | null
  fireError: string | null
  fireNeedsConfig: boolean
}

export interface DemografiaErrorResponse {
  error: string
}
