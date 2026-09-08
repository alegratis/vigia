/**
 * Client-safe types for /api/veredas — vereda (sub-municipal) administrative
 * boundaries for Sevilla, Caicedonia and Zarzal, sourced from DANE's
 * "Nivel de referencia veredas" geovisor (geoportal.dane.gov.co), with a
 * per-vereda hazard summary spatially aggregated server-side from data this
 * app already fetches at the point/municipio level. See
 * lib/veredas/server.ts for the full pipeline. No server imports here.
 */

export interface VeredaProperties {
  /** DANE's vereda code (DIVIPOLA departamento+municipio+vereda), e.g. "76895002". */
  codigoVereda: string
  nombre: string
  municipio: string

  /**
   * Average `IS_score` across `VIGIA_Amenaza_IS_Puntos` grid points whose
   * coordinates fall inside this vereda's boundary, or `null` where the
   * source layer has no coverage (Zarzal sits on the flat valley floor and
   * has no records in that layer — see lib/deslizamientos/client.ts).
   */
  isScoreAvg: number | null
  /** Most common susceptibility level among the same points, or `null` where uncovered. */
  dominantLevel: string | null
  /** Grid points used for this vereda's aggregate. 0 means no coverage (Zarzal). */
  puntosMuestra: number

  /** Population sums sourced from the susceptibility layer's per-point population attribution — `null` where uncovered. */
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
