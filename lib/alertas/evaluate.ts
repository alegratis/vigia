import type { ReachAssessment } from '@/lib/geoglows/service'
import type { SeismicEvent } from '@/lib/sismologia/api-types'
import { FIRE, FLOOD, LANDSLIDE, QUAKE, STATIC_SUSCEPTIBILITY_MIN } from './thresholds'
import type { AlertEvaluation, AlertTier } from './types'

/**
 * Reglas puras de cada amenaza: entradas -> nivel + evidencia. No leen red ni
 * base de datos, así que el backtest las puede reutilizar tal cual.
 *
 * Todas siguen la regla de dos llaves: susceptibilidad estática alta Y
 * disparador dinámico activo (sismos son la excepción: no tienen
 * susceptibilidad por vereda y se evalúan por magnitud y distancia).
 */

export interface LandslideInputs {
  staticScore: number | null
  triggerScore: number | null
  observed7dMm: number | null
  forecast24hMm: number | null
  forecast48hMm: number | null
}

export function evaluateLandslide(i: LandslideInputs): AlertEvaluation {
  const evidence = {
    static_score: i.staticScore,
    trigger_score: i.triggerScore,
    observed_7d_mm: i.observed7dMm,
    forecast_24h_mm: i.forecast24hMm,
    forecast_48h_mm: i.forecast48hMm,
  }
  const none: AlertEvaluation = { hazard: 'deslizamientos', tier: null, evidence }

  if (i.staticScore == null || i.staticScore < STATIC_SUSCEPTIBILITY_MIN) return none
  if (i.triggerScore == null) return none

  const wet7d = (mm: number) => i.observed7dMm != null && i.observed7dMm >= mm
  const rainAhead = (mm: number | null, floor: number) => mm != null && mm >= floor

  if (
    i.triggerScore >= LANDSLIDE.actuar.triggerMin &&
    (wet7d(LANDSLIDE.actuar.observed7dMm) || rainAhead(i.forecast24hMm, LANDSLIDE.actuar.forecast24hMm))
  ) {
    return { hazard: 'deslizamientos', tier: 'actuar', evidence }
  }

  if (
    i.triggerScore >= LANDSLIDE.prepararse.triggerMin &&
    (wet7d(LANDSLIDE.prepararse.observed7dMm) ||
      rainAhead(i.forecast48hMm, LANDSLIDE.prepararse.forecast48hMm))
  ) {
    return { hazard: 'deslizamientos', tier: 'prepararse', evidence }
  }

  return none
}

/**
 * Nivel de crecida de un tramo según el pronóstico GEOGLOWS. No incluye la
 * susceptibilidad de la vereda: eso lo aplica el orquestador, porque un mismo
 * río sirve a varias veredas.
 */
export function evaluateFloodReach(a: ReachAssessment): AlertEvaluation {
  const start = Date.parse(a.current.datetime)
  const hoursFromStart = (datetime: string) => (Date.parse(datetime) - start) / 3_600_000

  const reaches = (field: 'median' | 'upper', returnPeriod: keyof ReachAssessment['thresholds'], withinHours: number) =>
    a.series.some((p) => hoursFromStart(p.datetime) <= withinHours && p[field] >= a.thresholds[returnPeriod])

  const actuar =
    reaches('median', FLOOD.actuar.medianReturnPeriodYears, FLOOD.actuar.withinHours) ||
    reaches('upper', FLOOD.actuar.upperBandReturnPeriodYears, FLOOD.actuar.withinHours)
  const prepararse = reaches(
    'median',
    FLOOD.prepararse.medianReturnPeriodYears,
    FLOOD.prepararse.withinHours,
  )

  const tier: AlertTier | null = actuar ? 'actuar' : prepararse ? 'prepararse' : null
  return {
    hazard: 'inundaciones',
    tier,
    evidence: {
      reach_id: a.reachId,
      station: a.station?.name ?? null,
      peak_median_flow: Math.round(a.peak.flow * 10) / 10,
      peak_median_level: a.peak.level.key,
      peak_upper_level: a.peakUpper.level.key,
      current_level: a.current.level.key,
      units: a.units,
    },
  }
}

export interface FireInputs {
  staticScore: number | null
  fwi: number | null
}

/**
 * Candidato de incendio del día. La exigencia de "2 días seguidos" para
 * Prepararse la aplica la máquina de estados (ver state.ts), porque el FWI
 * cambia una vez al día y dos ciclos de 15 min verían el mismo valor.
 */
export function evaluateFire(i: FireInputs): AlertEvaluation {
  const evidence = { static_score: i.staticScore, fwi: i.fwi }
  const none: AlertEvaluation = { hazard: 'incendios', tier: null, evidence }
  if (i.staticScore == null || i.staticScore < STATIC_SUSCEPTIBILITY_MIN) return none
  if (i.fwi == null) return none
  if (i.fwi >= FIRE.actuar.fwiMin) return { hazard: 'incendios', tier: 'actuar', evidence }
  if (i.fwi >= FIRE.prepararse.fwiMin) return { hazard: 'incendios', tier: 'prepararse', evidence }
  return none
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface QuakeVerdict {
  tier: AlertTier | null
  distanceKm: number
}

export function evaluateQuake(event: SeismicEvent, zone: { lat: number; lon: number }): QuakeVerdict {
  const distance = distanceKm(zone.lat, zone.lon, event.lat, event.lon)
  if (event.magnitude >= QUAKE.actuar.magnitudeMin && distance <= QUAKE.actuar.maxDistanceKm) {
    return { tier: 'actuar', distanceKm: distance }
  }
  if (
    event.magnitude >= QUAKE.prepararse.magnitudeMin &&
    distance <= QUAKE.prepararse.maxDistanceKm
  ) {
    return { tier: 'prepararse', distanceKm: distance }
  }
  return { tier: null, distanceKm: distance }
}
