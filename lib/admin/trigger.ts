import { FIRE, FLOOD, LANDSLIDE, QUAKE, STATIC_SUSCEPTIBILITY_MIN } from '@/lib/alertas/thresholds'
import type { AlertHazard, AlertTier } from '@/lib/alertas/types'

export interface TriggerRow {
  label: string
  value: string
}

export interface TriggerDescription {
  summary: string
  rows: TriggerRow[]
}

export const HAZARD_LABEL: Record<AlertHazard, string> = {
  deslizamientos: 'Deslizamientos',
  inundaciones: 'Inundaciones',
  incendios: 'Incendios forestales',
  sismos: 'Sismos',
}

export const TIER_LABEL: Record<AlertTier, string> = {
  prepararse: 'Prepararse',
  actuar: 'Actuar',
}

const dateTime = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
})

export function formatBogota(iso: string | null | undefined): string {
  if (!iso) return 'Sin dato'
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 'Sin dato' : dateTime.format(ms)
}

type Evidence = Record<string, unknown>

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function fmt(value: number | null, digits = 0, unit = ''): string {
  if (value === null) return 'sin dato'
  const text = value.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return unit ? `${text} ${unit}` : text
}

function sourceLabel(source: string): string {
  const known: Record<string, string> = {
    'sgc-live': 'SGC (reporte en vivo)',
    sgc: 'SGC',
    usgs: 'USGS',
  }
  return known[source] ?? source
}

/** Etiquetas de las claves que conocemos; el resto se muestra tal cual en "Otros datos". */
const KNOWN_KEYS: Record<AlertHazard, string[]> = {
  sismos: ['event_id', 'magnitude', 'depth_km', 'distance_km', 'place', 'time', 'source'],
  deslizamientos: [
    'static_score',
    'trigger_score',
    'observed_7d_mm',
    'forecast_24h_mm',
    'forecast_48h_mm',
    'veredas_evaluadas',
    'veredas_en_alerta',
    'vereda_mas_critica',
  ],
  inundaciones: [
    'reach_id',
    'station',
    'peak_median_flow',
    'peak_median_level',
    'peak_upper_level',
    'current_level',
    'units',
    'static_score',
  ],
  incendios: ['static_score', 'fwi', 'veredas_evaluadas', 'veredas_en_alerta', 'vereda_mas_critica'],
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return 'sin dato'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function otherRows(hazard: AlertHazard, evidence: Evidence): TriggerRow[] {
  const known = new Set(KNOWN_KEYS[hazard])
  return Object.entries(evidence)
    .filter(([key]) => !known.has(key))
    .map(([key, value]) => ({ label: key, value: stringify(value) }))
}

function rollupRows(evidence: Evidence, veredaNames: Map<string, string>): TriggerRow[] {
  const rows: TriggerRow[] = []
  const evaluated = asNumber(evidence.veredas_evaluadas)
  const inAlert = asNumber(evidence.veredas_en_alerta)
  if (evaluated !== null && inAlert !== null) {
    rows.push({ label: 'Veredas en alerta', value: `${fmt(inAlert)} de ${fmt(evaluated)} evaluadas` })
  }
  const top = asText(evidence.vereda_mas_critica)
  if (top) rows.push({ label: 'Vereda más crítica', value: veredaNames.get(top) ?? top })
  return rows
}

function describeQuake(tier: AlertTier, evidence: Evidence): TriggerDescription {
  const rule = QUAKE[tier]
  const magnitude = asNumber(evidence.magnitude)
  const distance = asNumber(evidence.distance_km)
  const source = asText(evidence.source)
  const rows: TriggerRow[] = [
    { label: 'Magnitud', value: fmt(magnitude, 1) },
    { label: 'Distancia a la zona', value: fmt(distance, 0, 'km') },
    { label: 'Profundidad', value: fmt(asNumber(evidence.depth_km), 0, 'km') },
  ]
  const place = asText(evidence.place)
  if (place) rows.push({ label: 'Epicentro', value: place })
  rows.push({ label: 'Hora del sismo', value: formatBogota(asText(evidence.time)) })
  if (source) rows.push({ label: 'Fuente', value: sourceLabel(source) })
  const eventId = asText(evidence.event_id)
  if (eventId) rows.push({ label: 'ID del evento', value: eventId })

  return {
    summary: `Sismo de magnitud ${fmt(magnitude, 1)} a ${fmt(distance, 0, 'km')} de la zona. Cumple el criterio de ${TIER_LABEL[tier]}: magnitud ${fmt(rule.magnitudeMin, 1)} o más a ${fmt(rule.maxDistanceKm, 0, 'km')} o menos.`,
    rows: [...rows, ...otherRows('sismos', evidence)],
  }
}

function describeLandslide(tier: AlertTier, evidence: Evidence, veredaNames: Map<string, string>): TriggerDescription {
  const rule = LANDSLIDE[tier]
  const staticScore = asNumber(evidence.static_score)
  const triggerScore = asNumber(evidence.trigger_score)
  const observed = asNumber(evidence.observed_7d_mm)
  const forecast24 = asNumber(evidence.forecast_24h_mm)
  const forecast48 = asNumber(evidence.forecast_48h_mm)

  return {
    summary: `Regla de dos llaves cumplida para ${TIER_LABEL[tier]}: susceptibilidad estática ${fmt(staticScore, 2)} (mínimo ${fmt(STATIC_SUSCEPTIBILITY_MIN, 1)}) y disparador de lluvia ${fmt(triggerScore, 2)} (mínimo ${fmt(rule.triggerMin, 1)}), con ${fmt(observed, 0, 'mm')} observados en 7 días y ${fmt(forecast24, 0, 'mm')} pronosticados en 24 h.`,
    rows: [
      { label: 'Susceptibilidad estática', value: fmt(staticScore, 2) },
      { label: 'Disparador de lluvia', value: fmt(triggerScore, 2) },
      { label: 'Lluvia observada, 7 días', value: fmt(observed, 0, 'mm') },
      { label: 'Pronóstico, 24 h', value: fmt(forecast24, 0, 'mm') },
      { label: 'Pronóstico, 48 h', value: fmt(forecast48, 0, 'mm') },
      ...rollupRows(evidence, veredaNames),
      ...otherRows('deslizamientos', evidence),
    ],
  }
}

function describeFlood(tier: AlertTier, evidence: Evidence): TriggerDescription {
  const station = asText(evidence.station)
  const reach = asText(evidence.reach_id)
  const units = asText(evidence.units) ?? ''
  const flow = asNumber(evidence.peak_median_flow)
  const medianLevel = asText(evidence.peak_median_level)
  const upperLevel = asText(evidence.peak_upper_level)
  const currentLevel = asText(evidence.current_level)
  const criterion =
    tier === 'actuar'
      ? `la mediana alcanza el periodo de retorno de ${FLOOD.actuar.medianReturnPeriodYears} años, o la banda superior el de ${FLOOD.actuar.upperBandReturnPeriodYears} años, dentro de ${FLOOD.actuar.withinHours} h`
      : `la mediana alcanza el periodo de retorno de ${FLOOD.prepararse.medianReturnPeriodYears} años dentro de ${FLOOD.prepararse.withinHours} h`

  const rows: TriggerRow[] = []
  if (station) rows.push({ label: 'Estación', value: station })
  if (reach) rows.push({ label: 'Tramo del río', value: reach })
  rows.push(
    { label: 'Caudal pico (mediana)', value: units ? `${fmt(flow, 1)} ${units}` : fmt(flow, 1) },
    { label: 'Nivel pico (mediana)', value: medianLevel ?? 'sin dato' },
    { label: 'Nivel pico (banda superior)', value: upperLevel ?? 'sin dato' },
    { label: 'Nivel actual', value: currentLevel ?? 'sin dato' },
  )
  const staticScore = asNumber(evidence.static_score)
  if (staticScore !== null) rows.push({ label: 'Susceptibilidad estática', value: fmt(staticScore, 2) })

  return {
    summary: `Pronóstico de caudal GEOGLOWS${station ? ` en ${station}` : ''}: el nivel pico de la mediana es ${medianLevel ?? 'sin dato'} y el de la banda superior ${upperLevel ?? 'sin dato'}. Criterio de ${TIER_LABEL[tier]}: ${criterion}.`,
    rows: [...rows, ...otherRows('inundaciones', evidence)],
  }
}

function describeFire(tier: AlertTier, evidence: Evidence, veredaNames: Map<string, string>): TriggerDescription {
  const fwi = asNumber(evidence.fwi)
  const staticScore = asNumber(evidence.static_score)
  const criterion =
    tier === 'actuar'
      ? `clase Extrema, con un FWI de ${FIRE.actuar.fwiMin} o más`
      : `un FWI de ${FIRE.prepararse.fwiMin} o más durante ${FIRE.prepararse.consecutiveDays} días seguidos`

  return {
    summary: `Índice meteorológico de incendio (FWI) de ${fmt(fwi, 1)} en una zona con susceptibilidad ${fmt(staticScore, 2)}. Criterio de ${TIER_LABEL[tier]}: ${criterion}.`,
    rows: [
      { label: 'Índice FWI', value: fmt(fwi, 1) },
      { label: 'Susceptibilidad estática', value: fmt(staticScore, 2) },
      ...rollupRows(evidence, veredaNames),
      ...otherRows('incendios', evidence),
    ],
  }
}

export function describeTrigger(
  hazard: AlertHazard,
  tier: AlertTier,
  evidence: Evidence,
  veredaNames: Map<string, string> = new Map(),
): TriggerDescription {
  switch (hazard) {
    case 'sismos':
      return describeQuake(tier, evidence)
    case 'deslizamientos':
      return describeLandslide(tier, evidence, veredaNames)
    case 'inundaciones':
      return describeFlood(tier, evidence)
    case 'incendios':
      return describeFire(tier, evidence, veredaNames)
  }
}
