import 'server-only'
import { isValidTwilioSignature } from './twilio'

/** URL pública tal como la vio Twilio; detrás del proxy de Vercel hay que reconstruirla. */
export function publicRequestUrl(request: Request): string {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}${url.pathname}${url.search}`
}

export async function readSignedTwilioForm(
  request: Request,
): Promise<{ ok: true; params: Record<string, string> } | { ok: false }> {
  const form = await request.formData().catch(() => null)
  if (!form) return { ok: false }
  const params: Record<string, string> = {}
  form.forEach((value, key) => {
    if (typeof value === 'string') params[key] = value
  })
  const valid = isValidTwilioSignature(publicRequestUrl(request), params, request.headers.get('x-twilio-signature'))
  return valid ? { ok: true, params } : { ok: false }
}
