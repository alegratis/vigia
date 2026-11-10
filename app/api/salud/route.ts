import { NextResponse } from 'next/server'
import { isAdminSession } from '@/lib/admin/session'
import { readStoredStatuses } from '@/lib/upstream/resilient'
import { probeAll, UPSTREAM_SOURCES } from '@/lib/upstream/sources'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Estado de las fuentes externas de las que depende Vigía. Público en forma
 * resumida; el detalle de errores solo se incluye con sesión de administración.
 */
export async function GET() {
  const [probes, stored, admin] = await Promise.all([
    probeAll(),
    readStoredStatuses().catch(() => []),
    isAdminSession().catch(() => false),
  ])
  const storedByKey = new Map(stored.map((s) => [s.key, s]))

  const fuentes = UPSTREAM_SOURCES.map((source) => {
    const probe = probes.find((p) => p.id === source.id)
    const snapshot = source.snapshotKey ? storedByKey.get(source.snapshotKey) : undefined
    return {
      id: source.id,
      nombre: source.nombre,
      afecta: source.afecta,
      estado: probe?.alcanzable ? 'ok' : 'caida',
      latenciaMs: probe?.latenciaMs ?? null,
      respaldo: source.snapshotKey
        ? { guardado: Boolean(snapshot?.snapshotAt), actualizadoEn: snapshot?.snapshotAt ?? null }
        : null,
      ...(admin ? { httpStatus: probe?.httpStatus ?? null, error: probe?.error ?? null, ultimoEstadoServidor: snapshot?.state ?? null } : {}),
    }
  })

  const caidas = fuentes.filter((f) => f.estado === 'caida')
  const estado = caidas.length === 0 ? 'ok' : caidas.length === fuentes.length ? 'caido' : 'degradado'

  return NextResponse.json(
    { estado, revisadoEn: new Date().toISOString(), total: fuentes.length, caidas: caidas.length, fuentes },
    { status: estado === 'caido' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
