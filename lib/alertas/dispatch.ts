import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildAlertMessage, buildDigestMessage } from './messages'
import { CONTROLS } from './thresholds'
import { sendSms } from './twilio'
import { tierRank, type AlertHazard, type AlertTier, type Sensitivity } from './types'

interface EventRecord {
  id: string
  hazard: AlertHazard
  scope_key: string
  municipio_code: string
  vereda_code: string | null
  tier: AlertTier
  evidence: Record<string, unknown>
}

interface SubscriberRecord {
  id: string
  phone_e164: string
  sensitivity: Sensitivity
  quiet_start: number
  quiet_end: number
  paused_until: string | null
}

interface SubscriptionRecord {
  subscriber_id: string
  municipio_code: string
  municipio_name: string
  vereda_code: string | null
  vereda_name: string | null
  hazards: AlertHazard[]
  alert_subscribers: SubscriberRecord | SubscriberRecord[] | null
}

export interface DispatchResult {
  sends: number
  failures: number
}

const LOOKBACK_HOURS = 24

export function siteOrigin(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return production ? `https://${production}` : null
}

function bogotaHour(now: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: CONTROLS.timeZone,
  }).format(now)
  return Number(hour)
}

function inQuietHours(now: Date, start: number, end: number): boolean {
  const h = bogotaHour(now)
  return start > end ? h >= start || h < end : h >= start && h < end
}

function dailyGlobalCap(): number {
  const n = Number(process.env.ALERTS_DAILY_SEND_CAP ?? 200)
  return Number.isFinite(n) && n > 0 ? n : 200
}

function zoneLabel(sub: SubscriptionRecord): string {
  return sub.vereda_name ? `${sub.vereda_name} (${sub.municipio_name})` : sub.municipio_name
}

function matches(event: EventRecord, sub: SubscriptionRecord): boolean {
  if (!sub.hazards.includes(event.hazard)) return false
  if (sub.vereda_code) return event.scope_key === sub.vereda_code
  return event.scope_key === `mun:${sub.municipio_code}`
}

/**
 * Envía los eventos en vivo de las últimas 24 h que cada suscriptor aún no ha
 * recibido. La fila en alert_deliveries se reclama ANTES de enviar: la
 * restricción única (event_id, subscriber_id) impide un doble envío aunque dos
 * ciclos se solapen. Un solo SMS por suscriptor por ciclo (resumen si hay varios).
 */
export async function dispatchPending(now: Date, errors: string[]): Promise<DispatchResult> {
  const db = getSupabaseAdmin()
  const result: DispatchResult = { sends: 0, failures: 0 }
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000).toISOString()

  const { data: eventData, error: eventError } = await db
    .from('alert_events')
    .select('id, hazard, scope_key, municipio_code, vereda_code, tier, evidence')
    .eq('mode', 'live')
    .gte('created_at', since)
  if (eventError) throw new Error(`No se pudieron leer los eventos: ${eventError.message}`)
  const events = (eventData ?? []) as EventRecord[]
  if (events.length === 0) return result

  const { data: subData, error: subError } = await db
    .from('alert_subscriptions')
    .select(
      'subscriber_id, municipio_code, municipio_name, vereda_code, vereda_name, hazards, alert_subscribers!inner(id, phone_e164, sensitivity, quiet_start, quiet_end, paused_until, verified_at, unsubscribed_at)',
    )
    .not('alert_subscribers.verified_at', 'is', null)
    .is('alert_subscribers.unsubscribed_at', null)
  if (subError) throw new Error(`No se pudieron leer las suscripciones: ${subError.message}`)

  const { data: deliveryData, error: deliveryError } = await db
    .from('alert_deliveries')
    .select('event_id, subscriber_id, twilio_sid, id, status')
    .gte('created_at', since)
  if (deliveryError) throw new Error(`No se pudieron leer las entregas: ${deliveryError.message}`)

  const delivered = new Set<string>()
  const sentBySubscriber = new Map<string, Set<string>>()
  const allSent = new Set<string>()
  for (const d of deliveryData ?? []) {
    delivered.add(`${d.event_id}|${d.subscriber_id}`)
    if (d.status === 'failed') continue
    const sid = d.twilio_sid ?? d.id
    allSent.add(sid)
    const set = sentBySubscriber.get(d.subscriber_id) ?? new Set<string>()
    set.add(sid)
    sentBySubscriber.set(d.subscriber_id, set)
  }

  const bySubscriber = new Map<string, { subscriber: SubscriberRecord; subs: SubscriptionRecord[] }>()
  for (const row of (subData ?? []) as unknown as SubscriptionRecord[]) {
    const subscriber = Array.isArray(row.alert_subscribers) ? row.alert_subscribers[0] : row.alert_subscribers
    if (!subscriber) continue
    const entry = bySubscriber.get(subscriber.id) ?? { subscriber, subs: [] }
    entry.subs.push(row)
    bySubscriber.set(subscriber.id, entry)
  }

  const origin = siteOrigin()
  const detailUrl = origin ? `${origin}/alertas` : undefined
  const statusCallbackUrl = origin ? `${origin}/api/alertas/twilio/estado` : undefined
  const globalCap = dailyGlobalCap()

  for (const { subscriber, subs } of bySubscriber.values()) {
    if (subscriber.paused_until && Date.parse(subscriber.paused_until) > now.getTime()) continue

    const pending = new Map<string, { event: EventRecord; sub: SubscriptionRecord }>()
    for (const event of events) {
      if (delivered.has(`${event.id}|${subscriber.id}`)) continue
      for (const sub of subs) {
        if (!matches(event, sub)) continue
        // Quien se suscribe a todo el municipio solo recibe el nivel Actuar.
        if (!sub.vereda_code && event.tier !== 'actuar') continue
        const prior = pending.get(event.id)
        if (!prior || (prior.sub.vereda_code === null && sub.vereda_code !== null)) {
          pending.set(event.id, { event, sub })
        }
      }
    }

    let candidates = [...pending.values()]
    if (subscriber.sensitivity === 'solo_emergencias') {
      candidates = candidates.filter((c) => c.event.tier === 'actuar')
    }

    const quiet = inQuietHours(now, subscriber.quiet_start, subscriber.quiet_end)
    const subscriberSent = sentBySubscriber.get(subscriber.id)?.size ?? 0
    const capped = subscriberSent >= CONTROLS.maxSmsPerSubscriberPer24h
    // Las horas de silencio y el tope por persona retienen Prepararse; Actuar siempre pasa.
    candidates = candidates.filter((c) => c.event.tier === 'actuar' || (!quiet && !capped))
    if (candidates.length === 0) continue

    const globalFull = allSent.size >= globalCap
    if (globalFull) candidates = candidates.filter((c) => c.event.tier === 'actuar')
    if (candidates.length === 0) continue

    const claimRows = candidates.map((c) => ({
      event_id: c.event.id,
      subscriber_id: subscriber.id,
      status: 'queued',
    }))
    const { data: claimed, error: claimError } = await db
      .from('alert_deliveries')
      .upsert(claimRows, { onConflict: 'event_id,subscriber_id', ignoreDuplicates: true })
      .select('id, event_id')
    if (claimError) {
      errors.push(`entregas: ${claimError.message}`)
      continue
    }
    const claimedIds = new Map((claimed ?? []).map((c) => [c.event_id as string, c.id as string]))
    const toSend = candidates.filter((c) => claimedIds.has(c.event.id))
    if (toSend.length === 0) continue

    toSend.sort((a, b) => tierRank(b.event.tier) - tierRank(a.event.tier))
    const top = toSend[0]
    const message =
      toSend.length === 1
        ? buildAlertMessage({
            hazard: top.event.hazard,
            tier: top.event.tier,
            zone: zoneLabel(top.sub),
            magnitude: typeof top.event.evidence.magnitude === 'number' ? top.event.evidence.magnitude : undefined,
            distanceKm: typeof top.event.evidence.distance_km === 'number' ? top.event.evidence.distance_km : undefined,
            detailUrl,
          })
        : buildDigestMessage(toSend.length, top.event.tier, detailUrl)

    const sent = await sendSms(subscriber.phone_e164, message.body, { statusCallbackUrl })
    const ids = toSend.map((c) => claimedIds.get(c.event.id) as string)

    if (sent.ok) {
      await db
        .from('alert_deliveries')
        .update({ twilio_sid: sent.sid, status: 'sent', sent_at: new Date().toISOString() })
        .in('id', ids)
      result.sends++
      allSent.add(sent.sid ?? ids[0])
      const set = sentBySubscriber.get(subscriber.id) ?? new Set<string>()
      set.add(sent.sid ?? ids[0])
      sentBySubscriber.set(subscriber.id, set)
    } else {
      await db
        .from('alert_deliveries')
        .update({ status: 'failed', error_code: sent.errorCode ?? null })
        .in('id', ids)
      result.failures++
      errors.push(`sms: fallo ${sent.errorCode ?? 'desconocido'}`)
      // 21610: el número respondió STOP en Twilio; se marca la baja.
      if (sent.errorCode === '21610') {
        await db
          .from('alert_subscribers')
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq('id', subscriber.id)
      }
    }
  }

  return result
}
