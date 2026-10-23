import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'vigia_admin'
const SESSION_SECONDS = 60 * 60 * 8

function adminSecret(): string | null {
  const secret = process.env.ADMIN_PASSWORD
  return secret && secret.length > 0 ? secret : null
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function signature(expiresAt: number, secret: string): string {
  return createHmac('sha256', secret).update(`vigia-admin:${expiresAt}`).digest('hex')
}

export function isAdminConfigured(): boolean {
  return adminSecret() !== null
}

/** Compara resúmenes de igual longitud para no filtrar nada por tiempo de respuesta. */
export function passwordMatches(candidate: string): boolean {
  const secret = adminSecret()
  if (!secret) return false
  return timingSafeEqual(digest(candidate), digest(secret))
}

export async function createAdminSession(): Promise<void> {
  const secret = adminSecret()
  if (!secret) throw new Error('ADMIN_PASSWORD no está configurada')
  const expiresAt = Date.now() + SESSION_SECONDS * 1000
  const isProduction = process.env.NODE_ENV === 'production'
  const store = await cookies()
  store.set(COOKIE_NAME, `${expiresAt}.${signature(expiresAt, secret)}`, {
    httpOnly: true,
    secure: true,
    // En la vista previa de v0 la app corre dentro de un iframe, y ahí la cookie necesita SameSite=None.
    sameSite: isProduction ? 'lax' : 'none',
    path: '/',
    maxAge: SESSION_SECONDS,
  })
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function isAdminSession(): Promise<boolean> {
  const secret = adminSecret()
  if (!secret) return false
  const store = await cookies()
  const raw = store.get(COOKIE_NAME)?.value
  if (!raw) return false

  const [expiresRaw, provided] = raw.split('.')
  const expiresAt = Number(expiresRaw)
  if (!provided || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expected = signature(expiresAt, secret)
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}
