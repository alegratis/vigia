import 'server-only'
import { toGsm7 } from '@/lib/alertas/messages'
import { CONTROLS } from '@/lib/alertas/thresholds'
import { sendSms } from '@/lib/alertas/twilio'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { probeAll, UPSTREAM_SOURCES } from './sources'

/** Horas sin servicio tras las cuales se avisa por SMS. */
export const OUTAGE_ALERT_HOURS = 8
/** Si la última comprobación es más vieja que esto, el vigilante dejó de correr y el estado es desconocido. */
export const STALE_CHECK_MINUTES = 45

const HOUR_MS = 3_600_000
const SMS_LIMIT = 160
const CYCLE_COMPONENT_ID = 'ciclo-alertas'

export interface HealthRow {
  component_id: string
  label: string
  optional: boolean
  state: 'ok' | 'down'
  since: string
  last_ok_at: string | null
  last_checked_at: string
  last_error: string | null
  alerted_at: string | null
  alert_error: string | null
}

interface CheckedComponent {
  id: string
  label: string
  optional: boolean
  ok: boolean
  error: string | null
}

async function checkAlertCycle(): Promise<CheckedComponent> {
  const { data } = await getSupabaseAdmin()
    .from('alert_runs')
    .select('finished_at')
    .not('finished_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ageMinutes = data?.finished_at ? (Date.now() - Date.parse(data.finished_at as string)) / 60_000 : Infinity
  const ok = ageMinutes <= CONTROLS.staleCycleMinutes
  return {
    id: CYCLE_COMPONENT_ID,
    label: 'Evaluador de alertas',
    optional: false,
    ok,
    error: ok ? null : data?.finished_at ? `último ciclo hace ${Math.round(ageMinutes / 60)} h` : 'sin ciclos registrados',
  }
}

async function checkAll(): Promise<CheckedComponent[]> {
  const [probes, cycle] = await Promise.all([probeAll(), checkAlertCycle()])
  const sources = UPSTREAM_SOURCES.map((source): CheckedComponent => {
    const probe = probes.find((p) => p.id === source.id)
    return {
      id: source.id,
      label: source.nombre,
      optional: source.optional ?? false,
      ok: probe?.alcanzable ?? false,
      error: probe?.error ?? null,
    }
  })
  return [...sources, cycle]
}

function nextRow(component: CheckedComponent, previous: HealthRow | undefined, now: string): HealthRow {
  const state = component.ok ? 'ok' : 'down'
  const changed = previous?.state !== state
  return {
    component_id: component.id,
    label: component.label,
    optional: component.optional,
    state,
    since: !previous || changed ? now : previous.since,
    last_ok_at: component.ok ? now : (previous?.last_ok_at ?? null),
    last_checked_at: now,
    last_error: component.ok ? null : component.error,
    // Una caída nueva siempre puede avisar de nuevo; mientras dure la misma, solo se avisa una vez.
    alerted_at: component.ok || changed ? null : (previous?.alerted_at ?? null),
    alert_error: component.ok || changed ? null : (previous?.alert_error ?? null),
  }
}

/** Horas sin servicio. Se mide desde el último éxito para que una fuente intermitente no reinicie el contador. */
function outageHours(row: HealthRow, nowMs: number): number {
  return (nowMs - Date.parse(row.last_ok_at ?? row.since)) / HOUR_MS
}

export function buildOutageMessage(labels: string[]): string {
  const detailed = `VIGIA SISTEMA: caido hace mas de ${OUTAGE_ALERT_HOURS} h: ${labels.join(', ')}. Revise /admin`
  const body =
    toGsm7(detailed).length <= SMS_LIMIT
      ? detailed
      : `VIGIA SISTEMA: ${labels.length} servicios caidos hace mas de ${OUTAGE_ALERT_HOURS} h. Revise /admin`
  return toGsm7(body)
}

export function getAlertPhone(): string | null {
  const phone = process.env.STATUS_ALERT_PHONE?.trim()
  return phone && /^\+\d{8,15}$/.test(phone) ? phone : null
}

export interface HealthCheckSummary {
  checked: number
  down: string[]
  overdue: string[]
  notified: boolean
  alertError: string | null
}

export async function runHealthCheck(): Promise<HealthCheckSummary> {
  const db = getSupabaseAdmin()
  const now = new Date()
  const nowIso = now.toISOString()

  const [components, existing] = await Promise.all([
    checkAll(),
    db.from('service_health').select('*').then((r) => (r.data ?? []) as HealthRow[]),
  ])
  const previousById = new Map(existing.map((row) => [row.component_id, row]))
  const rows = components.map((c) => nextRow(c, previousById.get(c.id), nowIso))

  const overdue = rows.filter(
    (row) => row.state === 'down' && !row.optional && !row.alerted_at && outageHours(row, now.getTime()) >= OUTAGE_ALERT_HOURS,
  )

  let notified = false
  let alertError: string | null = null
  if (overdue.length > 0) {
    const phone = getAlertPhone()
    if (!phone) {
      alertError = 'STATUS_ALERT_PHONE no está configurado o no tiene formato internacional (+57...)'
    } else {
      const sent = await sendSms(phone, buildOutageMessage(overdue.map((row) => row.label)))
      notified = sent.ok
      alertError = sent.ok ? null : `${sent.errorCode ?? 'error'}: ${sent.error ?? 'no se pudo enviar'}`.slice(0, 200)
    }
    for (const row of overdue) {
      row.alerted_at = notified ? nowIso : null
      row.alert_error = alertError
    }
  }

  const { error } = await db.from('service_health').upsert(rows, { onConflict: 'component_id' })
  if (error) throw new Error(`No se pudo guardar el estado de los servicios: ${error.message}`)

  return {
    checked: rows.length,
    down: rows.filter((row) => row.state === 'down').map((row) => row.label),
    overdue: overdue.map((row) => row.label),
    notified,
    alertError,
  }
}

export async function sendTestAlert(): Promise<{ ok: boolean; error: string | null }> {
  const phone = getAlertPhone()
  if (!phone) return { ok: false, error: 'STATUS_ALERT_PHONE no está configurado o no tiene formato internacional (+57...)' }
  const sent = await sendSms(phone, toGsm7('VIGIA SISTEMA: prueba del aviso de servicios caidos. Si lo lee, el aviso funciona.'))
  return { ok: sent.ok, error: sent.ok ? null : `${sent.errorCode ?? 'error'}: ${sent.error ?? 'no se pudo enviar'}` }
}

export async function getServiceHealth(): Promise<HealthRow[]> {
  const { data } = await getSupabaseAdmin().from('service_health').select('*').order('component_id')
  return (data ?? []) as HealthRow[]
}

export type PublicStatus = 'ok' | 'degradado' | 'desconocido'

export function summarizeHealth(rows: HealthRow[], nowMs = Date.now()): { estado: PublicStatus; revisadoEn: string | null } {
  if (rows.length === 0) return { estado: 'desconocido', revisadoEn: null }
  const lastChecked = rows.reduce((max, row) => Math.max(max, Date.parse(row.last_checked_at)), 0)
  const revisadoEn = new Date(lastChecked).toISOString()
  if (nowMs - lastChecked > STALE_CHECK_MINUTES * 60_000) return { estado: 'desconocido', revisadoEn }
  const anyDown = rows.some((row) => row.state === 'down' && !row.optional)
  return { estado: anyDown ? 'degradado' : 'ok', revisadoEn }
}
