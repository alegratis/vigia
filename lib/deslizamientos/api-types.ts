/**
 * Client-safe response shapes for /api/deslizamientos — RED LabOT's
 * population/infrastructure-by-level exposure summary only. The map's own
 * hazard coloring comes from /api/veredas instead (see
 * lib/deslizamientos/hazard-model.ts); this endpoint no longer serves the
 * `VIGIA_Amenaza_IS_Puntos` point grid itself. No server imports.
 */

export interface PopulationByLevel {
  level: string
  total: number
  children: number
  elderly: number
}

/** Critical-infrastructure exposure counts summed by threat level, from the polygon layer's attributes. */
export interface ExposureByLevel {
  level: string
  schools: number
  hospitals: number
  pharmacies: number
  criticalInfra: number
}

export interface DeslizamientosResponse {
  generatedAt: string
  populationByLevel: PopulationByLevel[]
  exposureByLevel: ExposureByLevel[]
}

export interface DeslizamientosErrorResponse {
  error: string
}
