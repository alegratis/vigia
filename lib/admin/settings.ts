import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { AlertMode } from '@/lib/alertas/types'

export const ALERT_MODE_KEY = 'alerts_mode'

export function isAlertMode(value: unknown): value is AlertMode {
  return value === 'off' || value === 'shadow' || value === 'live'
}

function alertModeFromEnv(): AlertMode {
  const raw = (process.env.ALERTS_MODE ?? 'shadow').toLowerCase()
  return isAlertMode(raw) ? raw : 'shadow'
}

export interface AlertModeSetting {
  mode: AlertMode
  source: 'admin' | 'env'
  updatedAt: string | null
}

/** Valor guardado desde el panel; si no existe o la base falla, se usa ALERTS_MODE (por defecto, sombra). */
export async function getAlertModeSetting(): Promise<AlertModeSetting> {
  try {
    const { data } = await getSupabaseAdmin()
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', ALERT_MODE_KEY)
      .maybeSingle()
    if (data && isAlertMode(data.value)) {
      return { mode: data.value, source: 'admin', updatedAt: data.updated_at }
    }
  } catch (error) {
    console.error('[admin] no se pudo leer app_settings:', error instanceof Error ? error.message : error)
  }
  return { mode: alertModeFromEnv(), source: 'env', updatedAt: null }
}

export async function getAlertMode(): Promise<AlertMode> {
  return (await getAlertModeSetting()).mode
}

export async function setAlertMode(mode: AlertMode): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('app_settings')
    .upsert({ key: ALERT_MODE_KEY, value: mode, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`No se pudo guardar el ajuste: ${error.message}`)
}
