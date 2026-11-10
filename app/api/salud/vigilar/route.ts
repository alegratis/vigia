import { isCronAuthorized } from '@/lib/api/cron-auth'
import { runHealthCheck, sendTestAlert } from '@/lib/upstream/monitor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Lo llama pg_cron cada 10 minutos. Sondea las fuentes, actualiza service_health y,
 * si algo lleva caído más de 8 h, envía un SMS. `?prueba=1` solo envía un SMS de prueba.
 */
async function handle(request: Request): Promise<Response> {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  if (!isCronAuthorized(request)) return Response.json({ error: 'No autorizado' }, { status: 401 })

  try {
    if (new URL(request.url).searchParams.get('prueba') === '1') {
      return Response.json(await sendTestAlert())
    }
    return Response.json(await runHealthCheck())
  } catch (error) {
    console.error('[salud] vigilante fallido:', error instanceof Error ? error.message : error)
    return Response.json({ error: 'No se pudo completar la comprobación' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
