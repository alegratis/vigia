import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { getVeredaBoundaries } from '@/lib/veredas/boundaries'
import { normalizeColombianMobile } from './phone'
import { CONTROLS } from './thresholds'
import { ALERT_HAZARDS, type AlertHazard, type Sensitivity } from './types'
import { MUNICIPIOS, municipioCodeByName, municipioNameByCode } from './zones'

export interface ResolvedZone {
  municipioCode: string
  municipioName: string
  veredaCode: string | null
  veredaName: string | null
}

export interface Preferences {
  zones: ResolvedZone[]
  hazards: AlertHazard[]
  sensitivity: Sensitivity
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const SENSITIVITIES: readonly Sensitivity[] = ['solo_emergencias', 'preventivas_y_emergencias']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parsePhone(value: unknown): Parsed<string> {
  if (typeof value !== 'string') return { ok: false, error: 'Ingrese un celular colombiano valido.' }
  const phone = normalizeColombianMobile(value)
  return phone ? { ok: true, value: phone } : { ok: false, error: 'Ingrese un celular colombiano valido (10 digitos, empieza por 3).' }
}

export async function parsePreferences(body: Record<string, unknown>): Promise<Parsed<Preferences>> {
  const sensitivity = body.sensitivity
  if (typeof sensitivity !== 'string' || !SENSITIVITIES.includes(sensitivity as Sensitivity)) {
    return { ok: false, error: 'Nivel de sensibilidad invalido.' }
  }

  const rawHazards = Array.isArray(body.hazards) ? body.hazards : []
  const hazards = [...new Set(rawHazards)].filter((h): h is AlertHazard =>
    ALERT_HAZARDS.includes(h as AlertHazard),
  )
  if (hazards.length === 0) return { ok: false, error: 'Elija al menos una amenaza.' }

  const rawZones = Array.isArray(body.zones) ? body.zones : []
  if (rawZones.length === 0) return { ok: false, error: 'Elija al menos una zona.' }

  const boundaries = await getVeredaBoundaries()
  const byCode = new Map(boundaries.map((b) => [b.codigoVereda, b]))

  const seen = new Set<string>()
  const zones: ResolvedZone[] = []
  for (const item of rawZones) {
    if (!isRecord(item)) return { ok: false, error: 'Zona invalida.' }
    const veredaCode = typeof item.veredaCode === 'string' && item.veredaCode ? item.veredaCode : null

    if (veredaCode) {
      const b = byCode.get(veredaCode)
      const municipioCode = b ? municipioCodeByName(b.municipio) : null
      if (!b || !municipioCode) return { ok: false, error: 'Vereda no encontrada.' }
      const key = `v:${veredaCode}`
      if (seen.has(key)) continue
      seen.add(key)
      zones.push({ municipioCode, municipioName: b.municipio, veredaCode, veredaName: b.nombre })
    } else {
      const municipioCode = typeof item.municipioCode === 'string' ? item.municipioCode : ''
      const municipioName = municipioNameByCode(municipioCode)
      if (!municipioName) return { ok: false, error: 'Municipio no encontrado.' }
      const key = `m:${municipioCode}`
      if (seen.has(key)) continue
      seen.add(key)
      zones.push({ municipioCode, municipioName, veredaCode: null, veredaName: null })
    }
  }

  const veredaCount = zones.filter((z) => z.veredaCode).length
  if (veredaCount > CONTROLS.maxVeredasPerSubscriber) {
    return { ok: false, error: `Puede elegir hasta ${CONTROLS.maxVeredasPerSubscriber} veredas.` }
  }
  if (zones.length > CONTROLS.maxVeredasPerSubscriber + MUNICIPIOS.length) {
    return { ok: false, error: 'Demasiadas zonas.' }
  }

  return { ok: true, value: { zones, hazards, sensitivity: sensitivity as Sensitivity } }
}

export function generateManageToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() || null : null
}

/** Limitador en memoria por instancia: complementa los límites propios de Twilio Verify. */
const attempts = new Map<string, number[]>()
export function tooManyAttempts(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  attempts.set(key, recent)
  return recent.length > max
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
