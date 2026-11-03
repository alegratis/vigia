import { Badge } from '@/components/ui/badge'
import { describeDeliveryStatus, describeErrorCode } from '@/lib/admin/delivery'
import type { HistoryEvent, HistoryRecipient } from '@/lib/admin/history'
import { formatBogota, HAZARD_LABEL, TIER_LABEL } from '@/lib/admin/trigger'
import { cn } from '@/lib/utils'

function bodyLabel(recipient: HistoryRecipient): string {
  if (recipient.status === 'expected') return 'Texto que se habría enviado'
  if (recipient.status === 'pending') return 'Texto previsto'
  return recipient.bodyReconstructed ? 'Texto reconstruido (no se guardó al enviar)' : 'Texto enviado'
}

function Recipient({ recipient }: { recipient: HistoryRecipient }) {
  const status = describeDeliveryStatus(recipient.status)
  const error = describeErrorCode(recipient.errorCode)
  const isBad = status.tone === 'bad'

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-sm text-foreground">{recipient.phone}</span>
          <span className="text-xs text-muted-foreground">Suscrito a {recipient.zone}</span>
        </div>
        <Badge variant={isBad ? 'destructive' : status.tone === 'ok' ? 'default' : 'secondary'} title={status.hint}>
          {status.label}
        </Badge>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{status.hint}</p>

      {recipient.sentAt || recipient.deliveredAt ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {recipient.sentAt ? (
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Enviado</dt>
              <dd className="text-foreground">{formatBogota(recipient.sentAt)}</dd>
            </div>
          ) : null}
          {recipient.deliveredAt ? (
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Entregado</dt>
              <dd className="text-foreground">{formatBogota(recipient.deliveredAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {isBad ? (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-xs leading-relaxed text-destructive">
          {recipient.errorCode ? `Error ${recipient.errorCode}. ` : 'Sin código de error. '}
          {error ?? 'Twilio no devolvió un motivo. Revisa el registro del mensaje en la consola de Twilio.'}
        </p>
      ) : null}

      <figure className="flex flex-col gap-1.5">
        <figcaption className="text-xs font-medium text-muted-foreground">{bodyLabel(recipient)}</figcaption>
        <blockquote className="rounded-md border border-border bg-muted p-3 text-sm leading-relaxed text-foreground">
          {recipient.body}
          <span className="mt-2 block text-xs text-muted-foreground">{recipient.body.length} caracteres</span>
        </blockquote>
      </figure>
    </li>
  )
}

export function AlertEventCard({ event }: { event: HistoryEvent }) {
  const headingId = `evento-${event.id}`

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={event.tier === 'actuar' ? 'destructive' : 'secondary'}>{TIER_LABEL[event.tier]}</Badge>
          <Badge variant={event.mode === 'live' ? 'default' : 'outline'}>
            {event.mode === 'live' ? 'En vivo' : 'Sombra'}
          </Badge>
          <time dateTime={event.createdAt} className="text-xs text-muted-foreground">
            {formatBogota(event.createdAt)}
          </time>
        </div>
        <h3 id={headingId} className="text-balance text-base font-semibold text-foreground">
          {HAZARD_LABEL[event.hazard]} en {event.zone}
        </h3>
      </header>

      <section aria-label="Disparador" className="flex flex-col gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Disparador</h4>
        <p className="text-pretty text-sm leading-relaxed text-foreground">{event.trigger.summary}</p>
        <details className="group text-sm">
          <summary className="w-fit cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Ver los datos que lo dispararon
          </summary>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-md border border-border bg-background p-3 sm:grid-cols-2">
            {event.trigger.rows.map((row) => (
              <div key={row.label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="break-words text-sm tabular-nums text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section aria-label="Destinatarios" className="flex flex-col gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Destinatarios ({event.recipients.length})
        </h4>
        {event.recipients.length > 0 ? (
          <ul className={cn('flex flex-col gap-2')}>
            {event.recipients.map((recipient) => (
              <Recipient key={recipient.key} recipient={recipient} />
            ))}
          </ul>
        ) : (
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Ningún suscriptor activo coincide con esta zona y amenaza, así que este evento no genera ni generó ningún SMS.
          </p>
        )}
      </section>
    </article>
  )
}
