import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getAlertPhone, getServiceHealth, OUTAGE_ALERT_HOURS, summarizeHealth, type HealthRow } from '@/lib/upstream/monitor'

const SUMMARY = {
  ok: { text: 'Todo en orden', dot: 'status-glow text-status-ok' },
  degradado: { text: 'Algún servicio está caído', dot: 'status-glow text-status-warn' },
  desconocido: { text: 'Sin datos recientes', dot: 'text-muted-foreground/50' },
} as const

function formatDuration(from: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(from)) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.round(hours / 24)} días`
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}••••${phone.slice(-3)}`
}

function RowDetail({ row }: { row: HealthRow }) {
  if (row.state === 'ok') return <span className="text-muted-foreground">Operativo</span>
  const notice = row.alerted_at
    ? 'SMS enviado'
    : row.alert_error
      ? `Aviso pendiente: ${row.alert_error}`
      : row.optional
        ? null
        : `Aviso por SMS a las ${OUTAGE_ALERT_HOURS} h`
  return (
    <span className="text-foreground">
      {`Caído desde hace ${formatDuration(row.since)}`}
      {notice ? <span className="text-muted-foreground">{` · ${notice}`}</span> : null}
    </span>
  )
}

export async function ServiceStatusPanel() {
  const rows = await getServiceHealth()
  const { estado, revisadoEn } = summarizeHealth(rows)
  const summary = SUMMARY[estado]
  const phone = getAlertPhone()

  return (
    <section aria-labelledby="estado-servicios" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="estado-servicios" className="text-xl font-semibold tracking-tight text-foreground">
          Estado de los servicios
        </h2>
        <div className="flex items-center gap-2 text-sm text-foreground">
          <span aria-hidden="true" className={cn('size-2 rounded-full bg-current', summary.dot)} />
          {summary.text}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Aún no hay comprobaciones registradas. La primera llega con el siguiente ciclo, que se repite cada 10 minutos.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((row) => (
            <li key={row.component_id} className="flex items-start gap-3 p-3">
              <span
                aria-hidden="true"
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full bg-current',
                  row.state === 'ok' ? 'text-status-ok' : row.optional ? 'text-muted-foreground' : 'text-status-warn',
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {row.label}
                  {row.optional ? <Badge variant="outline">Opcional</Badge> : null}
                </p>
                <p className="text-xs">
                  <RowDetail row={row} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
        {phone
          ? `Si un servicio lleva más de ${OUTAGE_ALERT_HOURS} horas caído se envía un SMS a ${maskPhone(phone)}. Los servicios opcionales tienen alternativa y no generan aviso.`
          : 'Falta configurar la variable STATUS_ALERT_PHONE con tu número en formato internacional: sin ella no se envía el aviso por SMS.'}
        {revisadoEn ? ` Última comprobación hace ${formatDuration(revisadoEn)}.` : ''}
      </p>
    </section>
  )
}
