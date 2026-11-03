import 'server-only'
import { matches, siteOrigin, zoneLabel, type EventRecord, type SubscriberRecord, type SubscriptionRecord } from '@/lib/alertas/dispatch'
import { buildAlertMessage } from '@/lib/alertas/messages'
import type { AlertHazard, AlertTier } from '@/lib/alertas/types'
import { municipioNameByCode } from '@/lib/alertas/zones'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getVeredaBoundaries } from '@/lib/veredas/boundaries'
import { maskPhone } from '@/lib/admin/delivery'
import { describeTrigger, type TriggerDescription } from '@/lib/admin/trigger'

export type HistoryMode = 'live' | 'shadow'

export interface HistoryRecipient {
  key: string
  phone: string
  zone: string
  /** Estado de Twilio (sent, delivered, failed...) o expected / pending si no hay envío. */
  status: string
  errorCode: string | null
  sentAt: string | null
  deliveredAt: string | null
  body: string
  /** true cuando el texto no se guardó al enviar y se reconstruyó a partir del evento. */
  bodyReconstructed: boolean
}

export interface HistoryEvent {
  id: string
  hazard: AlertHazard
  tier: AlertTier
  mode: HistoryMode
  createdAt: string
  zone: string
  trigger: TriggerDescription
  recipients: HistoryRecipient[]
}

export interface HistoryTotals {
  events: number
  liveEvents: number
  shadowEvents: number
  delivered: number
  failed: number
  awaiting: number
  expected: number
}

export interface AlertHistory {
  events: HistoryEvent[]
  totals: HistoryTotals
  days: number
}

interface DeliveryRow {
  event_id: string
  subscriber_id: string
  status: string
  error_code: string | null
  sent_at: string | null
  delivered_at: string | null
  body: string | null
}

const MAX_EVENTS = 60
const BOUNDARY_TIMEOUT_MS = 4_000

/**
 * Los límites de veredas vienen de un servicio externo que a veces tarda o falla.
 * El historial no debe caerse por eso: se parte de los nombres guardados en las
 * suscripciones y se completan con los límites solo si llegan a tiempo.
 */
async function loadVeredaNames(subscriptions: SubscriptionRecord[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  for (const sub of subscriptions) {
    if (sub.vereda_code && sub.vereda_name) names.set(sub.vereda_code, `${sub.vereda_name} (${sub.municipio_name})`)
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const boundaries = await Promise.race([
      getVeredaBoundaries(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('tiempo agotado')), BOUNDARY_TIMEOUT_MS)
      }),
    ])
    for (const b of boundaries) names.set(b.codigoVereda, `${b.nombre} (${b.municipio})`)
  } catch {
    // Se usan solo los nombres de las suscripciones.
  } finally {
    clearTimeout(timer)
  }
  return names
}

function rebuildBody(event: EventRecord, zone: string): string {
  const evidence = event.evidence ?? {}
  const origin = siteOrigin()
  return buildAlertMessage({
    hazard: event.hazard,
    tier: event.tier,
    zone,
    magnitude: typeof evidence.magnitude === 'number' ? evidence.magnitude : undefined,
    distanceKm: typeof evidence.distance_km === 'number' ? evidence.distance_km : undefined,
    detailUrl: origin ? `${origin}/alertas` : undefined,
  }).body
}

function subscriberOf(row: SubscriptionRecord): SubscriberRecord | null {
  const raw = row.alert_subscribers
  return (Array.isArray(raw) ? raw[0] : raw) ?? null
}

/** Mismas reglas de destinatario que el despacho, sin horas de silencio ni topes. */
function expectedRecipients(event: EventRecord, subscriptions: SubscriptionRecord[], now: number) {
  const chosen = new Map<string, { subscriber: SubscriberRecord; sub: SubscriptionRecord }>()
  for (const sub of subscriptions) {
    const subscriber = subscriberOf(sub)
    if (!subscriber) continue
    if (subscriber.paused_until && Date.parse(subscriber.paused_until) > now) continue
    if (!matches(event, sub)) continue
    if (!sub.vereda_code && event.tier !== 'actuar') continue
    if (subscriber.sensitivity === 'solo_emergencias' && event.tier !== 'actuar') continue
    const prior = chosen.get(subscriber.id)
    if (!prior || (prior.sub.vereda_code === null && sub.vereda_code !== null)) {
      chosen.set(subscriber.id, { subscriber, sub })
    }
  }
  return chosen
}

export async function getAlertHistory(options: { mode?: HistoryMode; days?: number } = {}): Promise<AlertHistory> {
  const days = options.days ?? 30
  const db = getSupabaseAdmin()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let eventQuery = db
    .from('alert_events')
    .select('id, hazard, scope_key, municipio_code, vereda_code, tier, evidence, mode, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_EVENTS)
  if (options.mode) eventQuery = eventQuery.eq('mode', options.mode)

  const [eventResult, subscriptionResult] = await Promise.all([
    eventQuery,
    db
      .from('alert_subscriptions')
      .select(
        'subscriber_id, municipio_code, municipio_name, vereda_code, vereda_name, hazards, alert_subscribers!inner(id, phone_e164, sensitivity, quiet_start, quiet_end, paused_until, verified_at, unsubscribed_at)',
      )
      .not('alert_subscribers.verified_at', 'is', null)
      .is('alert_subscribers.unsubscribed_at', null),
  ])
  if (eventResult.error) throw new Error(`No se pudieron leer los eventos: ${eventResult.error.message}`)
  if (subscriptionResult.error) throw new Error(`No se pudieron leer las suscripciones: ${subscriptionResult.error.message}`)

  const events = (eventResult.data ?? []) as unknown as Array<EventRecord & { mode: HistoryMode; created_at: string }>
  const subscriptions = (subscriptionResult.data ?? []) as unknown as SubscriptionRecord[]
  const veredaNames = await loadVeredaNames(subscriptions)

  const deliveriesByEvent = new Map<string, DeliveryRow[]>()
  const phoneBySubscriber = new Map<string, string>()
  for (const sub of subscriptions) {
    const subscriber = subscriberOf(sub)
    if (subscriber) phoneBySubscriber.set(subscriber.id, subscriber.phone_e164)
  }

  if (events.length > 0) {
    const { data, error } = await db
      .from('alert_deliveries')
      .select('event_id, subscriber_id, status, error_code, sent_at, delivered_at, body')
      .in('event_id', events.map((e) => e.id))
    if (error) throw new Error(`No se pudieron leer las entregas: ${error.message}`)
    const rows = (data ?? []) as unknown as DeliveryRow[]
    for (const row of rows) {
      const list = deliveriesByEvent.get(row.event_id) ?? []
      list.push(row)
      deliveriesByEvent.set(row.event_id, list)
    }

    const missing = [...new Set(rows.map((r) => r.subscriber_id))].filter((id) => !phoneBySubscriber.has(id))
    if (missing.length > 0) {
      const { data: extra } = await db.from('alert_subscribers').select('id, phone_e164').in('id', missing)
      for (const s of (extra ?? []) as Array<{ id: string; phone_e164: string }>) {
        phoneBySubscriber.set(s.id, s.phone_e164)
      }
    }
  }

  const now = Date.now()
  const totals: HistoryTotals = {
    events: events.length,
    liveEvents: 0,
    shadowEvents: 0,
    delivered: 0,
    failed: 0,
    awaiting: 0,
    expected: 0,
  }

  const result: HistoryEvent[] = events.map((event) => {
    if (event.mode === 'live') totals.liveEvents++
    else totals.shadowEvents++

    const zone = event.scope_key.startsWith('mun:')
      ? `${municipioNameByCode(event.scope_key.slice(4)) ?? 'Municipio'} (todo el municipio)`
      : (veredaNames.get(event.scope_key) ?? event.scope_key)

    const expected = expectedRecipients(event, subscriptions, now)
    const deliveries = deliveriesByEvent.get(event.id) ?? []
    const recipients: HistoryRecipient[] = []

    for (const d of deliveries) {
      const match = expected.get(d.subscriber_id)
      const recipientZone = match ? zoneLabel(match.sub) : zone
      recipients.push({
        key: `${event.id}:${d.subscriber_id}`,
        phone: maskPhone(phoneBySubscriber.get(d.subscriber_id) ?? ''),
        zone: recipientZone,
        status: d.status,
        errorCode: d.error_code,
        sentAt: d.sent_at,
        deliveredAt: d.delivered_at,
        body: d.body ?? rebuildBody(event, recipientZone),
        bodyReconstructed: d.body === null,
      })
      if (d.status === 'delivered') totals.delivered++
      else if (d.status === 'failed' || d.status === 'undelivered') totals.failed++
      else totals.awaiting++
    }

    const delivered = new Set(deliveries.map((d) => d.subscriber_id))
    for (const [subscriberId, { subscriber, sub }] of expected) {
      if (delivered.has(subscriberId)) continue
      const recipientZone = zoneLabel(sub)
      recipients.push({
        key: `${event.id}:${subscriberId}:expected`,
        phone: maskPhone(subscriber.phone_e164),
        zone: recipientZone,
        status: event.mode === 'shadow' ? 'expected' : 'pending',
        errorCode: null,
        sentAt: null,
        deliveredAt: null,
        body: rebuildBody(event, recipientZone),
        bodyReconstructed: true,
      })
      if (event.mode === 'shadow') totals.expected++
    }

    return {
      id: event.id,
      hazard: event.hazard,
      tier: event.tier,
      mode: event.mode,
      createdAt: event.created_at,
      zone,
      trigger: describeTrigger(event.hazard, event.tier, (event.evidence ?? {}) as Record<string, unknown>, veredaNames),
      recipients,
    }
  })

  return { events: result, totals, days }
}
