import { NextResponse } from 'next/server'
import { getServiceHealth, summarizeHealth } from '@/lib/upstream/monitor'

export const dynamic = 'force-dynamic'

/** Estado agregado para el indicador público. No expone nombres de fuentes ni errores. */
export async function GET() {
  try {
    const summary = summarizeHealth(await getServiceHealth())
    return NextResponse.json(summary, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch {
    return NextResponse.json({ estado: 'desconocido', revisadoEn: null }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
