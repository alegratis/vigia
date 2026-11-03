import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AlertEventCard } from '@/components/admin/alert-event-card'
import { LogoutButton } from '@/components/admin/admin-session-actions'
import { isAdminSession } from '@/lib/admin/session'
import { getAlertHistory, type HistoryMode } from '@/lib/admin/history'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Historial de alertas | Vigía',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FILTERS: Array<{ value: HistoryMode | undefined; label: string; href: string }> = [
  { value: undefined, label: 'Todos', href: '/admin/alertas' },
  { value: 'live', label: 'En vivo', href: '/admin/alertas?modo=live' },
  { value: 'shadow', label: 'Sombra', href: '/admin/alertas?modo=shadow' },
]

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  )
}

export default async function AdminAlertHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>
}) {
  if (!(await isAdminSession())) redirect('/admin/login')

  const { modo } = await searchParams
  const mode: HistoryMode | undefined = modo === 'live' || modo === 'shadow' ? modo : undefined
  const history = await getAlertHistory({ mode })
  const { totals } = history

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver a administración
          </Link>
          <LogoutButton />
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">Historial de alertas</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {`Eventos de los últimos ${history.days} días con su disparador, el texto del SMS y el estado de entrega a cada destinatario. Los números se muestran parcialmente ocultos.`}
        </p>
      </header>

      <section aria-label="Resumen">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Eventos" value={totals.events} hint={`${totals.liveEvents} en vivo, ${totals.shadowEvents} en sombra`} />
          <Stat label="Entregados" value={totals.delivered} hint="Confirmados por la operadora" />
          <Stat label="Con problemas" value={totals.failed} hint="Fallidos o no entregados" />
          <Stat label="Habrían recibido" value={totals.expected} hint="Eventos en sombra, sin envío" />
        </dl>
      </section>

      <section aria-labelledby="eventos" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="eventos" className="text-xl font-semibold tracking-tight text-foreground">
            Eventos
          </h2>
          <nav aria-label="Filtrar por modo" className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {FILTERS.map((filter) => {
              const active = filter.value === mode
              return (
                <Link
                  key={filter.label}
                  href={filter.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {filter.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {history.events.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-4 text-pretty text-sm leading-relaxed text-muted-foreground">
            No hay eventos en este periodo con el filtro elegido.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {history.events.map((event) => (
              <AlertEventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
