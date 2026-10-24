import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { LoginForm } from '@/components/admin/login-form'
import { isAdminConfigured, isAdminSession } from '@/lib/admin/session'

export const metadata: Metadata = {
  title: 'Administración | Vigía',
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage() {
  if (await isAdminSession()) redirect('/admin')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al mapa
        </Link>
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">Administración</h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Acceso restringido. Desde aquí se activan y desactivan las funciones de Vigía.
        </p>
      </header>
      {isAdminConfigured() ? (
        <LoginForm />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          El panel no está configurado: falta la variable ADMIN_PASSWORD.
        </p>
      )}
    </main>
  )
}
