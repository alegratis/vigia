import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { readSignedTwilioForm } from '@/lib/alertas/webhook'

export const dynamic = 'force-dynamic'

/** Recibe los estados de entrega de Twilio (sent, delivered, undelivered, failed). */
export async function POST(request: Request) {
  const form = await readSignedTwilioForm(request)
  if (!form.ok) return new NextResponse('Firma invalida', { status: 403 })

  const sid = form.params.MessageSid
  const status = form.params.MessageStatus
  if (!sid || !status) return new NextResponse(null, { status: 204 })

  const update: Record<string, string | null> = { status }
  if (form.params.ErrorCode) update.error_code = form.params.ErrorCode
  if (status === 'delivered') update.delivered_at = new Date().toISOString()

  await getSupabaseAdmin().from('alert_deliveries').update(update).eq('twilio_sid', sid)
  return new NextResponse(null, { status: 204 })
}
