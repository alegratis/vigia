import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { AlertModeControl } from '@/components/admin/alert-mode-control'
import { LogoutButton, RunCycleButton } from '@/components/admin/admin-session-actions'
import { Badge } from '@/components/ui/badge'
import { isAdminSession } from '@/lib/admin/session'
import { getAlertStatus, type AlertStatus } from '@/lib/admin/status'

export const metadata: Metadata = {
  title: 'Administración | Vigía',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MODE_LABEL = { off: 'Apagado', shadow: 'Sombra', live: 'En vivo' } as const

function formatAge(minutes: number): string {
  if (minutes < 1) return 'hace menos de un minuto'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} días`
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  )
}

function SchedulerNotice({ status }: { status: AlertStatus }) {
  if (!status.schedulerStale) return null
  const detail = status.lastRun
    ? `El último ciclo terminó ${formatAge(status.lastRun.ageMinutes)}.`
    : 'No hay ningún ciclo registrado.'
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-border bg-muted p-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
      <p className="text-pretty text-sm leading-relaxed text-foreground">
        {`${detail} Nada está llamando al evaluador de forma periódica, así que aunque pases a modo en vivo no saldrá ningún SMS hasta que haya un programador activo. Mientras tanto puedes lanzar un ciclo a mano con el botón de abajo.`}
      </p>
    </div>
  )
}

export default async function AdminPage() {
  if (!(await isAdminSession())) redirect('/admin/login')

  const status = await getAlertStatus()
  const { setting } = status

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver al mapa
          </Link>
          <LogoutButton />
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">Administración</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Interruptores de las funciones de Vigía. Los cambios se guardan en la base de datos y se aplican desde el siguiente ciclo, sin volver a publicar.
        </p>
      </header>

      <section aria-labelledby="alertas-sms" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="alertas-sms" className="text-xl font-semibold tracking-tight text-foreground">
            Alertas por SMS
          </h2>
          <Badge variant={setting.mode === 'live' ? 'default' : 'secondary'}>{MODE_LABEL[setting.mode]}</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {setting.source === 'admin'
            ? 'Valor definido desde este panel.'
            : 'Aún no se ha cambiado desde el panel: se usa el valor por defecto del servidor (sombra).'}
        </p>

        <AlertModeControl
          current={setting.mode}
          twilioConfigured={status.twilioConfigured}
          activeSubscribers={status.activeSubscribers}
        />

        <SchedulerNotice status={status} />

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Suscriptores activos" value={String(status.activeSubscribers)} hint="Verificados y sin baja" />
          <Stat
            label="Twilio"
            value={status.twilioConfigured ? 'Configurado' : 'Falta configurar'}
            hint={status.twilioConfigured ? undefined : 'Sin Twilio no se puede pasar a vivo'}
          />
          <Stat
            label="Último ciclo"
            value={status.lastRun ? formatAge(status.lastRun.ageMinutes) : 'Ninguno'}
            hint={status.lastRun ? `Modo ${MODE_LABEL[status.lastRun.mode as keyof typeof MODE_LABEL] ?? status.lastRun.mode}` : undefined}
          />
          <Stat label="Eventos en sombra" value={String(status.shadowEvents7d)} hint="Últimos 7 días, no enviados" />
          <Stat label="Eventos en vivo" value={String(status.liveEvents7d)} hint="Últimos 7 días" />
          <Stat label="SMS enviados" value={String(status.deliveriesTotal)} hint="Total histórico" />
        </dl>

        <RunCycleButton />
      </section>
    </main>
  )
}
