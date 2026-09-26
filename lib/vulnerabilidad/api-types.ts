/** Client-safe response shapes for /api/vulnerabilidad. No server imports. */

import type { VulnerabilityLevel } from "./combined-score"

export interface VulnerabilidadVeredaProperties {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano?: boolean

  /**
   * Housing Vulnerability Index behind this vereda's score (0–1, higher =
   * more physically fragile housing stock). Manzana-derived for urban
   * cores, municipio-wide for rural veredas — see `hviResolution`.
   */
  hvi: number
  /** Whether `hvi` comes from manzana-level IPM (urban core) or the coarser municipio-wide déficit habitacional average (rural vereda). */
  hviResolution: "manzana" | "municipio"
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

export interface UrbanMunicipioHviSummary {
  municipio: string
  codigoMunicipio: string
  manzanaCount: number
  avgIpmPct: number
  hvi: number
}

export interface VulnerabilidadResponse {
  generatedAt: string
  veredas: VulnerabilidadFeatureCollection
  hviPorMunicipio: MunicipioHviSummary[]
  /** Manzana-derived HVI per municipio's urban core — the finer-grained value used for each "Casco Urbano" vereda. */
  hviUrbanoPorMunicipio: UrbanMunicipioHviSummary[]
  source: string
  sourceUrl: string
}

export interface VulnerabilidadErrorResponse {
  error: string
}
