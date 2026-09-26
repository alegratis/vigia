/** Client-safe response shapes for /api/vulnerabilidad. No server imports. */

import type { VulnerabilityLevel } from "./combined-score"

export interface VulnerabilidadVeredaProperties {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano?: boolean

  /** Housing Vulnerability Index of this vereda's municipio (0–1, higher = more physically fragile housing stock). */
  hvi: number
  /** This vereda's riesgo-compuesto hazard tier, rescaled to the 1–4 methodology scale. `null` if unresolved. */
  hazardScore: number | null
  /** HVI × HazardScore, range [0, 4]. `null` if the vereda has no resolved hazard tier. */
  combinedScore: number | null
  combinedLevel: VulnerabilityLevel | null

  /** The underlying riesgo-compuesto tier this vereda's hazard score was derived from, for the popup/legend. */
  compoundLevel: string | null
}

export interface VulnerabilidadFeature {
  type: "Feature"
  id: string
  properties: VulnerabilidadVeredaProperties
  geometry: {
    type: "MultiPolygon"
    coordinates: number[][][][]
  }
}

export interface VulnerabilidadFeatureCollection {
  type: "FeatureCollection"
  features: VulnerabilidadFeature[]
}

export interface MunicipioHviSummary {
  municipio: string
  codigoMunicipio: string
  componentAvgPct: number
  hvi: number
}

export interface VulnerabilidadResponse {
  generatedAt: string
  veredas: VulnerabilidadFeatureCollection
  hviPorMunicipio: MunicipioHviSummary[]
  source: string
  sourceUrl: string
}

export interface VulnerabilidadErrorResponse {
  error: string
}
