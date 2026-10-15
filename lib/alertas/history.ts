import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getVeredaBoundaries } from '@/lib/veredas/boundaries'
import type { AlertHazard, AlertTier } from './types'
import { municipioNameByCode } from './zones'

export const HISTORY_WINDOW_HOURS = 72

export interface PublicAlert {
  id: string
  hazard: AlertHazard
  tier: AlertTier
  zone: string
  createdAt: string
  magnitude: number | null
}

/** Alertas emitidas en modo real durante la ventana pública. Nunca incluye datos de suscriptores. */
export async function getRecentLiveAlerts(): Promise<PublicAlert[]> {
  const since = new Date(Date.now() - HISTORY_WINDOW_HOURS * 3_600_000).toISOString()
  const { data, error } = await getSupabaseAdmin()
    .from('alert_events')
    .select('id, hazard, scope_key, tier, evidence, created_at')
    .eq('mode', 'live')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error('No se pudo leer el historial de alertas.')

  const boundaries = await getVeredaBoundaries()
  const veredaNames = new Map(boundaries.map((b) => [b.codigoVereda, `${b.nombre} (${b.municipio})`]))

  return (data ?? []).map((e) => {
    const zone = e.scope_key.startsWith('mun:')
      ? (municipioNameByCode(e.scope_key.slice(4)) ?? 'Municipio')
      : (veredaNames.get(e.scope_key) ?? 'Vereda')
    const evidence = (e.evidence ?? {}) as Record<string, unknown>
    return {
      id: e.id,
      hazard: e.hazard as AlertHazard,
      tier: e.tier as AlertTier,
      zone,
      createdAt: e.created_at,
      magnitude: typeof evidence.magnitude === 'number' ? evidence.magnitude : null,
    }
  })
}
