'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

const INITIAL_STATE: LoginState = { error: null }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-password">Contraseña</Label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? 'admin-password-error' : undefined}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
        {state.error ? (
          <p id="admin-password-error" role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Spinner /> : null}
        Entrar
      </Button>
    </form>
  )
}
