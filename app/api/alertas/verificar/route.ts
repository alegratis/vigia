import { NextResponse } from 'next/server'
import { CONSENT_VERSION } from '@/lib/alertas/consent'
import { siteOrigin } from '@/lib/alertas/dispatch'
import {
  clientIp,
  generateManageToken,
  hashToken,
  parsePhone,
  parsePreferences,
  tooManyAttempts,
} from '@/lib/alertas/subscription'
import { checkVerification, isTwilioConfigured, sendSms } from '@/lib/alertas/twilio'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status })
}

/** Paso 2: confirma el código y recién entonces guarda al suscriptor y sus zonas. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return fail('Solicitud invalida.', 400)
  const input = body as Record<string, unknown>

  if (input.consent !== true) return fail('Debe aceptar el tratamiento de datos para continuar.', 400)
  const code = typeof input.code === 'string' ? input.code.trim() : ''
  if (!/^\d{4,8}$/.test(code)) return fail('Ingrese el codigo de 6 digitos.', 400)

  const phone = parsePhone(input.phone)
  if (!phone.ok) return fail(phone.error, 400)
  const preferences = await parsePreferences(input)
  if (!preferences.ok) return fail(preferences.error, 400)

  if (!isTwilioConfigured()) return fail('El servicio de alertas por SMS aun no esta habilitado.', 503)

  if (tooManyAttempts(`verify:${phone.value}`, 6, 600_000) || tooManyAttempts(`verify-ip:${clientIp(request)}`, 20, 3_600_000)) {
    return fail('Demasiados intentos. Espere unos minutos e intente de nuevo.', 429)
  }

  const check = await checkVerification(phone.value, code)
  if (!check.ok) return fail('No se pudo validar el codigo. Intente de nuevo.', 502)
  if (!check.approved) return fail('El codigo no es correcto o ya vencio.', 400)

  const db = getSupabaseAdmin()
  const now = new Date().toISOString()
  const token = generateManageToken()

  const { data: subscriber, error: upsertError } = await db
    .from('alert_subscribers')
    .upsert(
      {
        phone_e164: phone.value,
        verified_at: now,
        sensitivity: preferences.value.sensitivity,
        consent_at: now,
        consent_version: CONSENT_VERSION,
        unsubscribed_at: null,
        paused_until: null,
        manage_token_hash: hashToken(token),
      },
      { onConflict: 'phone_e164' },
    )
    .select('id')
    .single()
  if (upsertError || !subscriber) return fail('No se pudo guardar la suscripcion.', 500)

  await db.from('alert_subscriptions').delete().eq('subscriber_id', subscriber.id)
  const { error: zonesError } = await db.from('alert_subscriptions').insert(
    preferences.value.zones.map((z) => ({
      subscriber_id: subscriber.id,
      municipio_code: z.municipioCode,
      municipio_name: z.municipioName,
      vereda_code: z.veredaCode,
      vereda_name: z.veredaName,
      hazards: preferences.value.hazards,
    })),
  )
  if (zonesError) return fail('No se pudo guardar las zonas.', 500)

  const origin = siteOrigin()
  const manageUrl = origin ? `${origin}/alertas/gestionar#${token}` : null
  const zoneCount = preferences.value.zones.length
  const welcome = `VIGIA: alertas activadas para ${zoneCount} zona${zoneCount === 1 ? '' : 's'}. ${
    manageUrl ? `Gestione su suscripcion: ${manageUrl} ` : ''
  }Para salir responda SALIR. No es sistema oficial; en emergencia llame al 123.`
  await sendSms(phone.value, welcome)

  return NextResponse.json({ ok: true, manageToken: token })
}
