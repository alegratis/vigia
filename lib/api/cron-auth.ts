import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

/** Valida `Authorization: Bearer <CRON_SECRET>` comparando resúmenes de igual longitud. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}
