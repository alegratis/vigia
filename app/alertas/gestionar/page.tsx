import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ManageSubscription } from "@/components/alertas/manage-subscription"

export const metadata: Metadata = {
  title: "Gestionar alertas | Vigía",
  description: "Cambie las zonas, pause o cancele sus alertas por SMS de Vigía.",
  robots: { index: false, follow: false },
}

export default function GestionarAlertasPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al mapa
        </Link>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">Gestionar mis alertas</h1>
      </header>
      <ManageSubscription />
    </main>
  )
}
