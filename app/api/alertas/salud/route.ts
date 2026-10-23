import { NextResponse } from 'next/server'
import { getAlertModeSetting } from '@/lib/admin/settings'
import { CONTROLS } from '@/lib/alertas/thresholds'
import { isTwilioConfigured } from '@/lib/alertas/twilio'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Indica si el monitoreo sigue corriendo. Responde 503 si el último ciclo es demasiado viejo. */
export async function GET() {
  const { data } = await getSupabaseAdmin()
    .from('alert_runs')
    .select('started_at, finished_at, mode')
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastRunAt = data?.finished_at ?? null
  const ageMinutes = lastRunAt ? Math.round((Date.now() - Date.parse(lastRunAt)) / 60_000) : null
  const stale = ageMinutes === null || ageMinutes > CONTROLS.staleCycleMinutes

  return NextResponse.json(
    {
      ok: !stale,
      lastRunAt,
      ageMinutes,
      mode: (await getAlertModeSetting()).mode,
      twilioConfigured: isTwilioConfigured(),
    },
    { status: stale ? 503 : 200 },
  )
}
