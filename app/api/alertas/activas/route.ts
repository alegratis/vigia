import { NextResponse } from 'next/server'
import { getRecentLiveAlerts, HISTORY_WINDOW_HOURS } from '@/lib/alertas/history'

export const revalidate = 60

export async function GET() {
  try {
    const alerts = await getRecentLiveAlerts()
    return NextResponse.json({ ok: true, windowHours: HISTORY_WINDOW_HOURS, alerts })
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo leer el historial.' }, { status: 500 })
  }
}
