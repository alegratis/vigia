import { NextResponse } from 'next/server'
import { maskPhone } from '@/lib/alertas/phone'
import { clientIp, parsePhone, parsePreferences, tooManyAttempts } from '@/lib/alertas/subscription'
import { isTwilioConfigured, startVerification } from '@/lib/alertas/twilio'

export const dynamic = 'force-dynamic'

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status })
}

/** Paso 1: valida los datos y envía el código. No se guarda nada hasta verificar el código. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return fail('Solicitud invalida.', 400)
  const input = body as Record<string, unknown>

  if (input.consent !== true) return fail('Debe aceptar el tratamiento de datos para continuar.', 400)

  const phone = parsePhone(input.phone)
  if (!phone.ok) return fail(phone.error, 400)
  const preferences = await parsePreferences(input)
  if (!preferences.ok) return fail(preferences.error, 400)

  if (!isTwilioConfigured()) return fail('El servicio de alertas por SMS aun no esta habilitado.', 503)

  if (
    tooManyAttempts(`ip:${clientIp(request)}`, 10, 3_600_000) ||
    tooManyAttempts(`phone:${phone.value}`, 3, 600_000)
  ) {
    return fail('Demasiados intentos. Espere unos minutos e intente de nuevo.', 429)
  }

  const started = await startVerification(phone.value)
  if (!started.ok) return fail('No se pudo enviar el codigo. Intente de nuevo en unos minutos.', 502)

  return NextResponse.json({ ok: true, phoneMasked: maskPhone(phone.value) })
}
