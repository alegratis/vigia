import type { AlertHazard, AlertTier } from './types'

const SINGLE_SEGMENT_LIMIT = 160

/**
 * Deja el texto en GSM-7: un solo acento (á, í, ó, ú) pasa el mensaje a UCS-2,
 * baja el segmento a 70 caracteres y multiplica el costo. La ñ sí es GSM-7.
 */
export function toGsm7(text: string): string {
  return text
    .replace(/ñ/g, '\u0001')
    .replace(/Ñ/g, '\u0002')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/\u0002/g, 'Ñ')
    .replace(/[^\x20-\x7E\n\u00f1\u00d1]/g, '')
}

export interface AlertMessageInput {
  hazard: AlertHazard
  tier: AlertTier
  /** Vereda (o municipio) y municipio, ya resueltos. */
  zone: string
  /** Solo para sismos. */
  magnitude?: number
  distanceKm?: number
  detailUrl?: string
}

const PREPARE: Record<Exclude<AlertHazard, 'sismos'>, (zone: string) => string> = {
  deslizamientos: (z) =>
    `Lluvias intensas y alta susceptibilidad a deslizamientos en ${z}. Prepare a su familia y este atento.`,
  inundaciones: (z) => `Se pronostica crecida de rios cerca de ${z}. Prepare a su familia y este atento.`,
  incendios: (z) => `Alto peligro de incendio forestal en ${z}. Evite quemas y este atento.`,
}

const ACT: Record<Exclude<AlertHazard, 'sismos'>, (zone: string) => string> = {
  deslizamientos: (z) => `Riesgo ALTO de deslizamiento en ${z}. Alejese de laderas y quebradas. Emergencia: 123.`,
  inundaciones: (z) => `Riesgo ALTO de crecida en ${z}. Alejese de rios y quebradas. Emergencia: 123.`,
  incendios: (z) => `Peligro EXTREMO de incendio en ${z}. No haga quemas. Emergencia: 123.`,
}

function core(input: AlertMessageInput): string {
  const zone = toGsm7(input.zone)

  if (input.hazard === 'sismos') {
    const mag = input.magnitude?.toFixed(1) ?? '?'
    const km = input.distanceKm !== undefined ? Math.round(input.distanceKm) : '?'
    const base = `Sismo M${mag} reportado a ${km} km de ${zone}. Mantenga la calma.`
    return input.tier === 'actuar' ? `${base} Emergencia: 123.` : base
  }

  return input.tier === 'actuar' ? ACT[input.hazard](zone) : PREPARE[input.hazard](zone)
}

export interface BuiltMessage {
  body: string
  length: number
  singleSegment: boolean
}

export function buildAlertMessage(input: AlertMessageInput): BuiltMessage {
  const prefix = input.tier === 'actuar' ? 'VIGIA ALERTA: ' : 'VIGIA: '
  const optOut = ' Salir: SALIR'
  const detail = input.detailUrl ? ` Detalle: ${input.detailUrl}.` : ''

  let body = `${prefix}${core(input)}${detail}${optOut}`
  if (body.length > SINGLE_SEGMENT_LIMIT && detail) {
    body = `${prefix}${core(input)}${optOut}`
  }

  return { body, length: body.length, singleSegment: body.length <= SINGLE_SEGMENT_LIMIT }
}

/** Resumen cuando varias veredas o amenazas cambian en el mismo ciclo. */
export function buildDigestMessage(count: number, tier: AlertTier, detailUrl?: string): BuiltMessage {
  const prefix = tier === 'actuar' ? 'VIGIA ALERTA: ' : 'VIGIA: '
  const tail = tier === 'actuar' ? ' Emergencia: 123.' : ''
  const detail = detailUrl ? ` Detalle: ${detailUrl}.` : ''
  const body = `${prefix}${count} avisos nuevos en sus zonas.${tail}${detail} Salir: SALIR`
  return { body, length: body.length, singleSegment: body.length <= SINGLE_SEGMENT_LIMIT }
}
