import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

const API = 'https://api.twilio.com/2010-04-01'
const VERIFY_API = 'https://verify.twilio.com/v2'

export interface TwilioConfig {
  accountSid: string
  authToken: string
  messagingServiceSid: string
  verifyServiceSid: string
}

export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!accountSid || !authToken || !messagingServiceSid || !verifyServiceSid) return null
  return { accountSid, authToken, messagingServiceSid, verifyServiceSid }
}

export function isTwilioConfigured(): boolean {
  return getTwilioConfig() !== null
}

function authHeader(config: TwilioConfig): string {
  return `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`
}

async function postForm(
  url: string,
  config: TwilioConfig,
  fields: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(config),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: response.ok, status: response.status, json }
}

export interface SendResult {
  ok: boolean
  sid?: string
  errorCode?: string
  error?: string
}

export async function sendSms(
  to: string,
  body: string,
  options: { statusCallbackUrl?: string } = {},
): Promise<SendResult> {
  const config = getTwilioConfig()
  if (!config) return { ok: false, error: 'Twilio no configurado' }

  const fields: Record<string, string> = {
    To: to,
    MessagingServiceSid: config.messagingServiceSid,
    Body: body,
  }
  if (options.statusCallbackUrl) fields.StatusCallback = options.statusCallbackUrl

  try {
    const res = await postForm(`${API}/Accounts/${config.accountSid}/Messages.json`, config, fields)
    if (res.ok) return { ok: true, sid: String(res.json.sid ?? '') }
    return {
      ok: false,
      errorCode: res.json.code != null ? String(res.json.code) : String(res.status),
      error: typeof res.json.message === 'string' ? res.json.message : `HTTP ${res.status}`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function startVerification(to: string): Promise<{ ok: boolean; error?: string }> {
  const config = getTwilioConfig()
  if (!config) return { ok: false, error: 'Twilio no configurado' }
  try {
    const res = await postForm(`${VERIFY_API}/Services/${config.verifyServiceSid}/Verifications`, config, {
      To: to,
      Channel: 'sms',
      Locale: 'es',
    })
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function checkVerification(to: string, code: string): Promise<{ ok: boolean; approved: boolean }> {
  const config = getTwilioConfig()
  if (!config) return { ok: false, approved: false }
  try {
    const res = await postForm(
      `${VERIFY_API}/Services/${config.verifyServiceSid}/VerificationCheck`,
      config,
      { To: to, Code: code },
    )
    return { ok: res.ok || res.status === 404, approved: res.ok && res.json.status === 'approved' }
  } catch {
    return { ok: false, approved: false }
  }
}

/**
 * Valida X-Twilio-Signature: HMAC-SHA1 de la URL más los parámetros ordenados
 * (clave + valor), en base64, con el Auth Token como clave.
 */
export function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token || !signature) return false
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url)
  const expected = createHmac('sha1', token).update(data).digest()
  const given = Buffer.from(signature, 'base64')
  return given.length === expected.length && timingSafeEqual(given, expected)
}
