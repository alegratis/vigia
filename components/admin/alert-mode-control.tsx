'use client'

import { useState, useTransition } from 'react'
import { setAlertModeAction, type ActionResult } from '@/app/admin/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

type Mode = 'off' | 'shadow' | 'live'

const OPTIONS: { mode: Mode; label: string; description: string }[] = [
  {
    mode: 'off',
    label: 'Apagado',
    description: 'El motor no evalúa nada: no registra eventos ni envía mensajes.',
  },
  {
    mode: 'shadow',
    label: 'Sombra',
    description: 'Evalúa y registra los eventos, pero no envía ningún SMS. Sirve para validar el motor.',
  },
  {
    mode: 'live',
    label: 'En vivo',
    description: 'Evalúa y envía SMS reales a los suscriptores verificados cuando se cruza un umbral.',
  },
]

interface Props {
  current: Mode
  twilioConfigured: boolean
  activeSubscribers: number
}

export function AlertModeControl({ current, twilioConfigured, activeSubscribers }: Props) {
  const [pending, startTransition] = useTransition()
  const [confirmingLive, setConfirmingLive] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)

  function apply(mode: Mode) {
    setResult(null)
    startTransition(async () => {
      setResult(await setAlertModeAction(mode))
    })
  }

  function select(mode: Mode) {
    if (mode === current || pending) return
    if (mode === 'live') {
      setConfirmingLive(true)
      return
    }
    apply(mode)
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Modo de las alertas por SMS" className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const selected = option.mode === current
          const blocked = option.mode === 'live' && !twilioConfigured
          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending || blocked}
              onClick={() => select(option.mode)}
              className={cn(
                'flex min-h-11 flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
                selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    selected ? 'bg-primary' : 'bg-muted-foreground/40',
                  )}
                />
                {option.label}
              </span>
              <span className="text-pretty text-xs leading-relaxed text-muted-foreground">{option.description}</span>
            </button>
          )
        })}
      </div>

      <p role="status" aria-live="polite" className={cn('min-h-5 text-sm', result?.ok === false ? 'text-destructive' : 'text-muted-foreground')}>
        {pending ? 'Guardando…' : (result?.message ?? '')}
      </p>

      <AlertDialog open={confirmingLive} onOpenChange={setConfirmingLive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Activar los SMS en vivo?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Desde el siguiente ciclo, cualquier evento nuevo enviará SMS reales a los ${activeSubscribers} suscriptores verificados. Los eventos que se registraron en sombra no se envían. Puedes volver a sombra o apagarlo cuando quieras.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apply('live')}>Activar en vivo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
