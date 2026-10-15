import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, BellRing } from "lucide-react"
import { HAZARD_LABELS } from "@/lib/alertas/client"
import { OFFICIAL_DISCLAIMER } from "@/lib/alertas/consent"
import { getRecentLiveAlerts, HISTORY_WINDOW_HOURS, type PublicAlert } from "@/lib/alertas/history"

export const metadata: Metadata = {
  title: "Alertas recientes | Vigía",
  description: "Alertas por SMS emitidas por Vigía en las últimas 72 horas en Sevilla, Caicedonia, Zarzal y Roldanillo.",
}

export const revalidate = 60

const formatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
})

async function loadAlerts(): Promise<PublicAlert[] | null> {
  try {
    return await getRecentLiveAlerts()
  } catch {
    return null
  }
}

export default async function AlertasPage() {
  const alerts = await loadAlerts()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al mapa
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">Alertas recientes</h1>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            Lo mismo que reciben los suscriptores por SMS, de las últimas {HISTORY_WINDOW_HOURS} horas. Una alerta
            aparece aquí solo cuando hay una probabilidad alta de que ocurra el evento.
          </p>
        </div>
      </header>

      {alerts === null && (
        <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          No se pudo cargar el historial en este momento. Intente de nuevo en unos minutos.
        </p>
      )}

      {alerts?.length === 0 && (
        <div className="flex flex-col items-start gap-2 rounded-md border border-border p-5">
          <p className="font-medium text-foreground">Sin alertas en las últimas {HISTORY_WINDOW_HOURS} horas</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Eso es buena señal: los umbrales son estrictos para que un SMS siempre signifique algo.
          </p>
        </div>
      )}

      {alerts && alerts.length > 0 && (
        <ul className="flex flex-col gap-3">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-md border border-border p-4">
              <BellRing
                className={`mt-0.5 size-4 shrink-0 ${a.tier === "actuar" ? "text-destructive" : "text-primary"}`}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {a.tier === "actuar" ? "Actuar" : "Prepararse"} · {HAZARD_LABELS[a.hazard]}
                </p>
                <p className="text-sm text-muted-foreground">{a.zone}</p>
                <time dateTime={a.createdAt} className="text-xs text-muted-foreground">
                  {formatter.format(new Date(a.createdAt))}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{OFFICIAL_DISCLAIMER}</p>
    </main>
  )
}
