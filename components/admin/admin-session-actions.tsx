'use client'

import { useState, useTransition } from 'react'
import { LogOut, Play } from 'lucide-react'
import { logoutAction, runCycleAction, type ActionResult } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function RunCycleButton() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)

  function run() {
    setResult(null)
    startTransition(async () => {
      setResult(await runCycleAction())
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={run} disabled={pending} className="w-fit">
        {pending ? <Spinner /> : <Play aria-hidden="true" />}
        Ejecutar un ciclo ahora
      </Button>
      <p role="status" aria-live="polite" className={cn('min-h-5 text-sm', result?.ok === false ? 'text-destructive' : 'text-muted-foreground')}>
        {pending ? 'Evaluando las unidades. Puede tardar un minuto…' : (result?.message ?? '')}
      </p>
    </div>
  )
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut aria-hidden="true" />
        Cerrar sesión
      </Button>
    </form>
  )
}
