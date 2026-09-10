/**
 * Client-safe types for /api/veredas — vereda (sub-municipal) administrative
 * boundaries for Sevilla, Caicedonia and Zarzal, sourced from Esri
 * Colombia's "Veredas de Colombia" layer plus a per-municipio "Casco
 * Urbano" boundary from DANE's zona urbana layer (see
 * lib/veredas/boundaries.ts), with a per-vereda hazard summary spatially
 * aggregated server-side from data this app already fetches at the
 * point/municipio level. See lib/veredas/server.ts for the full pipeline.
 * No server imports here.
 */

import type { FloodSusceptibilityLevel } from "@/lib/inundaciones/levels"

export interface VeredaProperties {
  /** DIVIPOLA vereda code (departamento+municipio+vereda), e.g. "76895002" — or a synthetic "<mpio-code>-urbano" id for the Casco Urbano pseudo-vereda. */
  codigoVereda: string
  nombre: string
  municipio: string
  /** True for the municipio's cabecera municipal ("Casco Urbano") pseudo-vereda rather than a rural vereda. */
  esCascoUrbano?: boolean

  /**
   * Final 0–1 composite score from this app's own hazard model (slope +
   * road proximity + rainfall-anomaly trigger — see
   * lib/deslizamientos/hazard-model.ts), computed at this vereda's
   * centroid. `null` only if every input factor failed for this vereda.
   * Covers all three municipios, including Zarzal.
   */
  isScoreAvg: number | null
  /** Hazard level from the same model, mapped onto the app's shared 5-level scheme. */
  dominantLevel: string | null
  /** Terrain slope (degrees) at this vereda's centroid. */
  slopeDeg: number | null
  /** Distance (km) from this vereda's centroid to the nearest OSM road. */
  roadDistanceKm: number | null
  /** Distance (km) from this vereda's centroid to the nearest mapped geological fault (SGC Atlas Geológico). */
  faultDistanceKm: number | null
  /** Distance (km) from this vereda's centroid to the nearest documented historical mass movement (SGC's national inventory). */
  historyDistanceKm: number | null
  /** Current antecedent-rainfall index over its 3-year same-season baseline; `null` if no baseline could be formed. */
  rainfallRatio: number | null

  /**
   * Final 0–1 composite score from this app's own flood hazard model
   * (official zoning + stream proximity + terrain flatness — see
   * lib/inundaciones/hazard-model.ts), computed at this vereda's
   * centroid. Covers all three municipios, including Zarzal.
   */
  floodScoreAvg: number | null
  /** Flood hazard level from the same model, mapped onto the zoning layer's own 5-level vocabulary. */
  floodLevel: FloodSusceptibilityLevel | null
  /** Distance (km) from this vereda's centroid to the nearest named stream/creek trace. */
  floodStreamDistanceKm: number | null
  /** Official zoning class at this centroid, or `null` outside the zoning layer's coverage. */
  floodZoningLevel: FloodSusceptibilityLevel | null
  /** Whether this centroid falls inside the official zoning layer's coverage at all — `false` for every vereda in Zarzal. */
  floodZoningCovered: boolean

  /** RED LabOT `VIGIA_Amenaza_IS_Puntos` grid points used for this vereda's population/infrastructure sums below. 0 means no coverage (Zarzal, which that layer never covered). */
  puntosMuestra: number

  /** Population sums sourced from RED LabOT's susceptibility layer's per-point population attribution — `null` where uncovered. */
  poblacion: number | null
  poblacionMenores5: number | null
  poblacionMayores60: number | null
  escuelas: number | null
  hospitales: number | null
  farmacias: number | null
  infraestructuraCritica: number | null

  /** Count of "Sitios críticos" (2019 field survey) falling inside this vereda. */
  sitiosCriticos: number
}

export interface VeredaFeature {
  type: "Feature"
  id: string
  properties: VeredaProperties
  geometry: {
    type: "MultiPolygon"
    coordinates: number[][][][]
  }
}

export interface VeredasFeatureCollection {
  type: "FeatureCollection"
  features: VeredaFeature[]
}

export interface VeredasResponse {
  generatedAt: string
  veredas: VeredasFeatureCollection
}

export interface VeredasErrorResponse {
  error: string
}
