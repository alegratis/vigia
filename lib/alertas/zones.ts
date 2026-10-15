import 'server-only'
import { centroid } from '@turf/centroid'
import { multiPolygon } from '@turf/helpers'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getVeredaBoundaries } from '@/lib/veredas/boundaries'

import { MUNICIPIOS } from './municipios'

export { MUNICIPIOS }

export function municipioCodeByName(name: string): string | null {
  const target = name.trim().toLowerCase()
  return MUNICIPIOS.find((m) => m.name.toLowerCase() === target)?.code ?? null
}

export function municipioNameByCode(code: string): string | null {
  return MUNICIPIOS.find((m) => m.code === code)?.name ?? null
}

export function municipioScopeKey(municipioCode: string): string {
  return `mun:${municipioCode}`
}

export interface VeredaUnit {
  veredaCode: string
  veredaName: string
  municipioCode: string
  municipioName: string
  lat: number
  lon: number
  isUrban: boolean
}

export interface Monitoring {
  /** Veredas que hay que evaluar (suscritas directamente o dentro de un municipio suscrito). */
  units: VeredaUnit[]
  /** Códigos de municipio con suscripciones a todo el municipio. */
  municipioScopes: string[]
  /** Códigos de vereda con suscripciones directas. */
  veredaScopes: string[]
  /** Centroide medio de cada municipio, para la regla de distancia de sismos. */
  municipioCentroids: Record<string, { lat: number; lon: number }>
  /** Total de suscripciones activas consideradas. */
  subscriptions: number
}

interface SubscriptionRow {
  municipio_code: string
  vereda_code: string | null
  alert_subscribers:
    | { verified_at: string | null; unsubscribed_at: string | null }
    | Array<{ verified_at: string | null; unsubscribed_at: string | null }>
    | null
}

function watchlistMunicipios(): string[] {
  return (process.env.ALERTS_WATCH_MUNICIPIOS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Determina qué hay que evaluar en este ciclo. Solo se evalúan las zonas con
 * suscriptores activos (verificados y sin baja), más una lista opcional de
 * municipios de vigilancia (`ALERTS_WATCH_MUNICIPIOS`) para poder calibrar en
 * modo sombra antes de tener suscriptores.
 */
export async function loadMonitoring(): Promise<Monitoring> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('alert_subscriptions')
    .select('municipio_code, vereda_code, alert_subscribers!inner(verified_at, unsubscribed_at)')
  if (error) throw new Error(`No se pudieron leer las suscripciones: ${error.message}`)

  const municipioScopes = new Set<string>(watchlistMunicipios())
  const veredaScopes = new Set<string>()
  let subscriptions = 0

  for (const row of (data ?? []) as unknown as SubscriptionRow[]) {
    const sub = Array.isArray(row.alert_subscribers) ? row.alert_subscribers[0] : row.alert_subscribers
    if (!sub?.verified_at || sub.unsubscribed_at) continue
    subscriptions++
    if (row.vereda_code) veredaScopes.add(row.vereda_code)
    else municipioScopes.add(row.municipio_code)
  }

  const boundaries = await getVeredaBoundaries()
  const all: VeredaUnit[] = []
  for (const b of boundaries) {
    const municipioCode = municipioCodeByName(b.municipio)
    if (!municipioCode) continue
    const [lon, lat] = centroid(multiPolygon(b.polygons)).geometry.coordinates
    all.push({
      veredaCode: b.codigoVereda,
      veredaName: b.nombre,
      municipioCode,
      municipioName: b.municipio,
      lat,
      lon,
      isUrban: Boolean(b.esCascoUrbano),
    })
  }

  const municipioCentroids: Monitoring['municipioCentroids'] = {}
  for (const m of MUNICIPIOS) {
    const rural = all.filter((u) => u.municipioCode === m.code && !u.isUrban)
    if (rural.length === 0) continue
    municipioCentroids[m.code] = {
      lat: rural.reduce((s, u) => s + u.lat, 0) / rural.length,
      lon: rural.reduce((s, u) => s + u.lon, 0) / rural.length,
    }
  }

  const units = all.filter((u) =>
    veredaScopes.has(u.veredaCode) || (municipioScopes.has(u.municipioCode) && !u.isUrban),
  )

  return {
    units,
    municipioScopes: [...municipioScopes],
    veredaScopes: [...veredaScopes],
    municipioCentroids,
    subscriptions,
  }
}
