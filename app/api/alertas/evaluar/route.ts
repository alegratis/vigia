import { createHash, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { runEvaluation } from '@/lib/alertas/run'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  // Se comparan resumenes de igual longitud para no filtrar nada por tiempo de respuesta.
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

async function handle(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ?wait=1 ejecuta el ciclo y devuelve el resumen (para pruebas manuales).
  if (new URL(request.url).searchParams.get('wait') === '1') {
    return Response.json(await runEvaluation())
  }

  // Respuesta inmediata: pg_net no debe esperar un ciclo largo.
  after(async () => {
    try {
      await runEvaluation()
    } catch (error) {
      console.error('[alertas] ciclo fallido:', error instanceof Error ? error.message : error)
    }
  })
  return Response.json({ accepted: true }, { status: 202 })
}

export const POST = handle
export const GET = handle
