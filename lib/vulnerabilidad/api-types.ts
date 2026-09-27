/** Client-safe response shapes for /api/vulnerabilidad. No server imports. */

import type { VulnerabilityLevel } from "./combined-score"

export interface VulnerabilidadVeredaProperties {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano?: boolean

  /**
   * Social Vulnerability Index behind this vereda's score (0–1, higher =
   * more socially vulnerable). Manzana-derived for urban cores,
   * municipio-wide for rural veredas — see `ivsResolution`.
   */
  ivs: number
  /** Whether `ivs` comes from manzana-level IPM (urban core) or the coarser municipio-wide IVS average (rural vereda). */
  ivsResolution: "manzana" | "municipio"
  /** This vereda's riesgo-compuesto hazard tier, rescaled to the 1–4 methodology scale. `null` if unresolved. */
  hazardScore: number | null
  /** IVS × HazardScore, range [0, 4]. `null` if the vereda has no resolved hazard tier. */
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

/**
 * One genuine manzana (city block) inside a municipio's urban core, each
 * with its own IVS and combined score — the actual block-level resolution
 * behind `ivsUrbanoPorMunicipio`, rendered as its own map polygon instead
 * of being collapsed into a single value for the whole urban area.
 */
export interface ManzanaVulnerabilidadProperties {
  codigoManzana: string
  /** Nearest OSM place name to this manzana's centroid, or `null` — use instead of `codigoManzana` in any UI. */
  barrio: string | null
  codigoMunicipio: string
  municipio: string
  /** This specific manzana's own IVS (0–1), not a municipio-wide average. */
  ivs: number
  /** The enclosing "Casco Urbano" pseudo-vereda's hazard tier, rescaled to 1–4 — every manzana in that urban core shares the same physical-hazard exposure. `null` if unresolved. */
  hazardScore: number | null
  /** This manzana's IVS × the urban core's hazardScore, range [0, 4]. `null` if unresolved. */
  combinedScore: number | null
  combinedLevel: VulnerabilityLevel | null
  /** The underlying riesgo-compuesto tier the urban core's hazard score was derived from. */
  compoundLevel: string | null
}

export interface ManzanaVulnerabilidadFeature {
  type: "Feature"
  id: string
  properties: ManzanaVulnerabilidadProperties
  geometry: GeoJSON.Geometry
}

export interface ManzanaVulnerabilidadFeatureCollection {
  type: "FeatureCollection"
  features: ManzanaVulnerabilidadFeature[]
}

export interface MunicipioIvsSummary {
  municipio: string
  codigoMunicipio: string
  componentAvgPct: number
  ivs: number
  /** The 10 raw component percentages behind `componentAvgPct` (4 Vivienda + 4 Servicios + Educación + Trabajo), keyed by component id — see lib/vulnerabilidad/ivs-components.ts for labels. */
  components: Record<string, number>
}

export interface ManzanaIvsSummary {
  codigoManzana: string
  /** Nearest OSM place name to this manzana's centroid, or `null` — use instead of `codigoManzana` in any UI. */
  barrio: string | null
  ipm: number
  ivs: number
}

export interface UrbanMunicipioIvsSummary {
  municipio: string
  codigoMunicipio: string
  manzanaCount: number
  avgIpmPct: number
  ivs: number
  /** Every manzana behind `avgIpmPct`, sorted by `ivs` descending — the block-level breakdown for the bar chart. */
  manzanas: ManzanaIvsSummary[]
}

export interface VulnerabilidadResponse {
  generatedAt: string
  /** Rural veredas only — urban cores are now rendered manzana-by-manzana via `manzanas` instead of one polygon per municipio. */
  veredas: VulnerabilidadFeatureCollection
  /** Every manzana in the 4 municipios' urban cores, each with its own IVS and combined score — the actual block-level polygons behind `ivsUrbanoPorMunicipio`. */
  manzanas: ManzanaVulnerabilidadFeatureCollection
  ivsPorMunicipio: MunicipioIvsSummary[]
  /** Manzana-derived IVS per municipio's urban core — the finer-grained value used for each "Casco Urbano" vereda. */
  ivsUrbanoPorMunicipio: UrbanMunicipioIvsSummary[]
  source: string
  sourceUrl: string
}

export interface VulnerabilidadErrorResponse {
  error: string
}
