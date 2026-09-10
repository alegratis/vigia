/** Client-safe types for /api/sismologia/eventos and /api/sismologia/danos. No server imports. */

export type SeismicSource = "usgs" | "sgc"

export interface SeismicEvent {
  id: string
  source: SeismicSource
  /** ISO timestamp of occurrence. */
  time: string
  magnitude: number
  /** km below the surface, when published. */
  depthKm: number | null
  lat: number
  lon: number
  /** Human-readable place description, when published (USGS only). */
  place: string | null
}

export interface SismologiaEventosResponse {
  generatedAt: string
  /** Bounding box actually queried, so the map/legend can state the search radius. */
  bbox: { south: number; west: number; north: number; east: number }
  usgs: {
    events: SeismicEvent[]
    /** Days back the live USGS feed was queried. */
    windowDays: number
    ok: boolean
  }
  sgc: {
    events: SeismicEvent[]
    ok: boolean
  }
}

export interface SismologiaEventosErrorResponse {
  error: string
}

/** One barrio's aggregated, privacy-safe damage-report summary — no individual points, addresses, or victim counts. */
export interface BarrioDamageSummary {
  barrio: string
  totalReportes: number
  /** Counts by `estado_de_la_vivienda_tras_el_s` (Destruida / Dañado / Posiblemente dañado). */
  porEstado: Record<string, number>
}

export interface SismologiaDanosResponse {
  generatedAt: string
  /** Always "Sevilla" — the only municipio with Survey123 field-report coverage. */
  municipio: string
  totalReportes: number
  /** Reports whose point fell outside every known barrio polygon. */
  sinBarrio: number
  barrios: BarrioDamageSummary[]
}

export interface SismologiaDanosErrorResponse {
  error: string
}
