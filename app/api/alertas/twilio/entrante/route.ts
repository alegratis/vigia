import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { readSignedTwilioForm } from '@/lib/alertas/webhook'

export const dynamic = 'force-dynamic'

const OPT_OUT_WORDS = new Set(['salir', 'baja', 'cancelar', 'parar', 'stop', 'stopall', 'unsubscribe'])

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

function twiml(status = 200) {
  return new Response(EMPTY_TWIML, { status, headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
}

/**
 * Twilio ya atiende STOP/PARAR de forma nativa (bloquea el número). Este webhook
 * cubre las palabras en español, para que la baja también quede en nuestra base.
 */
export async function POST(request: Request) {
  const form = await readSignedTwilioForm(request)
  if (!form.ok) return new Response('Firma invalida', { status: 403 })

  const word = (form.params.Body ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const from = form.params.From
  if (!from || !OPT_OUT_WORDS.has(word)) return twiml()

  const db = getSupabaseAdmin()
  const { data } = await db
    .from('alert_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('phone_e164', from)
    .select('id')
    .maybeSingle()
  if (data) await db.from('alert_subscriptions').delete().eq('subscriber_id', data.id)
  return twiml()
}
