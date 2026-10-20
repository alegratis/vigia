import { NextResponse } from 'next/server'
import { maskPhone } from '@/lib/alertas/phone'
import { bearerToken, hashToken, parsePreferences } from '@/lib/alertas/subscription'
import type { AlertHazard, Sensitivity } from '@/lib/alertas/types'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const MAX_PAUSE_DAYS = 30

interface SubscriberRow {
  id: string
  phone_e164: string
  sensitivity: Sensitivity
  paused_until: string | null
  unsubscribed_at: string | null
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status })
}

async function authenticate(request: Request): Promise<SubscriberRow | null> {
  const token = bearerToken(request)
  if (!token) return null
  const { data } = await getSupabaseAdmin()
    .from('alert_subscribers')
    .select('id, phone_e164, sensitivity, paused_until, unsubscribed_at')
    .eq('manage_token_hash', hashToken(token))
    .maybeSingle()
  return (data as SubscriberRow | null) ?? null
}

export async function GET(request: Request) {
  const subscriber = await authenticate(request)
  if (!subscriber) return fail('Enlace de gestion invalido o vencido.', 401)

  const { data: rows } = await getSupabaseAdmin()
    .from('alert_subscriptions')
    .select('municipio_code, municipio_name, vereda_code, vereda_name, hazards')
    .eq('subscriber_id', subscriber.id)

  const hazards = (rows?.[0]?.hazards ?? []) as AlertHazard[]
  return NextResponse.json({
    ok: true,
    phoneMasked: maskPhone(subscriber.phone_e164),
    sensitivity: subscriber.sensitivity,
    pausedUntil: subscriber.paused_until,
    unsubscribed: subscriber.unsubscribed_at !== null,
    hazards,
    zones: (rows ?? []).map((r) => ({
      municipioCode: r.municipio_code,
      municipioName: r.municipio_name,
      veredaCode: r.vereda_code,
      veredaName: r.vereda_name,
    })),
  })
}

export async function PATCH(request: Request) {
  const subscriber = await authenticate(request)
  if (!subscriber) return fail('Enlace de gestion invalido o vencido.', 401)
  const body: unknown = await request.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return fail('Solicitud invalida.', 400)
  const input = body as Record<string, unknown>
  const db = getSupabaseAdmin()

  if ('pauseDays' in input) {
    const days = Number(input.pauseDays)
    if (!Number.isFinite(days) || days < 0 || days > MAX_PAUSE_DAYS) return fail('Pausa invalida.', 400)
    const pausedUntil = days === 0 ? null : new Date(Date.now() + days * 86_400_000).toISOString()
    await db.from('alert_subscribers').update({ paused_until: pausedUntil }).eq('id', subscriber.id)
    return NextResponse.json({ ok: true, pausedUntil })
  }

  const preferences = await parsePreferences(input)
  if (!preferences.ok) return fail(preferences.error, 400)

  await db
    .from('alert_subscribers')
    .update({ sensitivity: preferences.value.sensitivity, unsubscribed_at: null })
    .eq('id', subscriber.id)
  await db.from('alert_subscriptions').delete().eq('subscriber_id', subscriber.id)
  const { error } = await db.from('alert_subscriptions').insert(
    preferences.value.zones.map((z) => ({
      subscriber_id: subscriber.id,
      municipio_code: z.municipioCode,
      municipio_name: z.municipioName,
      vereda_code: z.veredaCode,
      vereda_name: z.veredaName,
      hazards: preferences.value.hazards,
    })),
  )
  if (error) return fail('No se pudieron guardar los cambios.', 500)
  return NextResponse.json({ ok: true })
}

/** Sin parámetros: baja (se conserva el número para respetar la baja). Con ?erase=1: borra todos los datos. */
export async function DELETE(request: Request) {
  const subscriber = await authenticate(request)
  if (!subscriber) return fail('Enlace de gestion invalido o vencido.', 401)
  const db = getSupabaseAdmin()

  if (new URL(request.url).searchParams.get('erase') === '1') {
    await db.from('alert_subscribers').delete().eq('id', subscriber.id)
    return NextResponse.json({ ok: true, erased: true })
  }

  await db.from('alert_subscriptions').delete().eq('subscriber_id', subscriber.id)
  await db
    .from('alert_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', subscriber.id)
  return NextResponse.json({ ok: true, erased: false })
}
