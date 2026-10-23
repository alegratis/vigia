import 'server-only'
import { CONTROLS } from '@/lib/alertas/thresholds'
import { isTwilioConfigured } from '@/lib/alertas/twilio'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getAlertModeSetting, type AlertModeSetting } from '@/lib/admin/settings'

export interface AlertStatus {
  setting: AlertModeSetting
  twilioConfigured: boolean
  activeSubscribers: number
  shadowEvents7d: number
  liveEvents7d: number
  deliveriesTotal: number
  lastRun: {
    finishedAt: string
    mode: string
    eventsCreated: number
    sends: number
    ageMinutes: number
  } | null
  schedulerStale: boolean
}

export async function getAlertStatus(): Promise<AlertStatus> {
  const db = getSupabaseAdmin()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [setting, subscribers, shadow, live, deliveries, run] = await Promise.all([
    getAlertModeSetting(),
    db
      .from('alert_subscribers')
      .select('*', { count: 'exact', head: true })
      .not('verified_at', 'is', null)
      .is('unsubscribed_at', null),
    db.from('alert_events').select('*', { count: 'exact', head: true }).eq('mode', 'shadow').gte('created_at', since),
    db.from('alert_events').select('*', { count: 'exact', head: true }).eq('mode', 'live').gte('created_at', since),
    db.from('alert_deliveries').select('*', { count: 'exact', head: true }),
    db
      .from('alert_runs')
      .select('finished_at, mode, events_created, sends')
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const lastRun = run.data?.finished_at
    ? {
        finishedAt: run.data.finished_at as string,
        mode: run.data.mode as string,
        eventsCreated: (run.data.events_created as number | null) ?? 0,
        sends: (run.data.sends as number | null) ?? 0,
        ageMinutes: Math.round((Date.now() - Date.parse(run.data.finished_at as string)) / 60_000),
      }
    : null

  return {
    setting,
    twilioConfigured: isTwilioConfigured(),
    activeSubscribers: subscribers.count ?? 0,
    shadowEvents7d: shadow.count ?? 0,
    liveEvents7d: live.count ?? 0,
    deliveriesTotal: deliveries.count ?? 0,
    lastRun,
    schedulerStale: lastRun === null || lastRun.ageMinutes > CONTROLS.staleCycleMinutes,
  }
}
