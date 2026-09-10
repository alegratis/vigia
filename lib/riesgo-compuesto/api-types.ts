/**
 * Client-safe types for /api/riesgo-compuesto/veredas — this app's own
 * compound multi-hazard assessment per vereda, composed entirely from data
 * this app already computes for the other four categories (see
 * lib/riesgo-compuesto/server.ts). No server imports here.
 */

import type { CompoundLevel, IdeamActionTier } from "./levels"

/** The four hazards this category combines — same names used across the app's other categories. */
export type HazardName = "deslizamientos" | "inundaciones" | "incendios" | "precipitacion"

export interface SubHazardSummary {
  hazard: HazardName
  label: string
  /** This hazard's own level label (its native vocabulary, e.g. "Alta" for inundaciones), or `null` if unresolved for this vereda. */
  rawLevel: string | null
  /** This hazard's contribution normalized to 0–1 (higher = worse), the common scale the compound score/tier are computed from. `null` if unresolved. */
  normalizedScore: number | null
  /** Raw CSS color token from this hazard's own palette, so the report stays visually consistent with that hazard's own map/legend. */
  colorToken: string
  /** Short, human-readable contributing factor, e.g. "Pendiente: 12.4°" or "Acumulado 7 días: 62.1 mm" — filled from data already computed for that hazard, never invented. */
  detail: string | null
}

export interface CompoundNarrative {
  /** One-line action-tier + dominant-hazard summary. */
  resumen: string
  /** Per-hazard breakdown paragraph. */
  desglose: string
  /** Population/infrastructure exposure paragraph. */
  demografia: string
}

export interface CompoundVeredaProperties {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano?: boolean

  /** Max-ordinal compound level across the four hazards (WMO/GDACS "highest hazard governs" doctrine) — `null` only if every hazard was unresolved. */
  compoundLevel: CompoundLevel | null
  /** Weighted composite 0–1 score (INFORM Risk Index style), equal 25% weights re-normalized over whichever hazards resolved. Used for ranking/color intensity, not the headline tier. */
  compoundScore: number | null
  /** IDEAM's Informar/Prepararse/Actuar framing, derived from compoundLevel. */
  actionTier: IdeamActionTier | null
  /** Whichever hazard produced the max-ordinal tier (ties broken by highest normalized score). */
  dominantHazard: HazardName | null
  /** All four hazards' own level/score/detail, in a fixed order (deslizamientos, inundaciones, incendios, precipitación). */
  subHazards: SubHazardSummary[]

  /** Population/infrastructure fields reused as-is from lib/veredas/aggregate.ts — same convention: `null` where RED LabOT's grid has no coverage (Zarzal). */
  poblacion: number | null
  poblacionMenores5: number | null
  poblacionMayores60: number | null
  escuelas: number | null
  hospitales: number | null
  farmacias: number | null
  infraestructuraCritica: number | null
  sitiosCriticos: number

  /** Deterministic Spanish narrative templates — filled from the fields above, never free-text generated. */
  narrative: CompoundNarrative
}

export interface CompoundFeature {
  type: "Feature"
  id: string
  properties: CompoundVeredaProperties
  geometry: {
    type: "MultiPolygon"
    coordinates: number[][][][]
  }
}

export interface CompoundFeatureCollection {
  type: "FeatureCollection"
  features: CompoundFeature[]
}

export interface RiesgoCompuestoResponse {
  generatedAt: string
  veredas: CompoundFeatureCollection
}

export interface RiesgoCompuestoErrorResponse {
  error: string
}
