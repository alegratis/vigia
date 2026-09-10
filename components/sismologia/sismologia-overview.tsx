"use client"

import { AlertTriangle, Activity, Gauge, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSismologiaEventos } from "@/lib/sismologia/use-sismologia"

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  )
}

/**
 * Summary stats card for the sismología panel: recent USGS event count,
 * max magnitude across both sources, and the most recent event's
 * timestamp — mirrors `FireOverview`'s metric-card layout.
 */
export function SismologiaOverview() {
  const { data, error, isLoading, mutate, isValidating } = useSismologiaEventos()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
            <p className="font-medium">No se pudo cargar la actividad sísmica</p>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Reintentar
          </button>
        </CardContent>
      </Card>
    )
  }

  const allEvents = [...data.usgs.events, ...data.sgc.events]
  const maxMagnitude = allEvents.reduce((max, e) => Math.max(max, e.magnitude), 0)
  const latestUsgs = data.usgs.events[0] ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Actualizado {formatDateTime(data.generatedAt)} · {data.usgs.events.length} eventos USGS en{" "}
          {data.usgs.windowDays} días · {data.sgc.events.length} eventos SGC históricos
        </p>
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={isValidating ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          Actualizar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard
          label="Eventos USGS (90 días)"
          value={String(data.usgs.events.length)}
          icon={<Activity className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Magnitud máxima"
          value={maxMagnitude > 0 ? `M ${maxMagnitude.toFixed(1)}` : "—"}
          icon={<Gauge className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Último evento USGS"
          value={latestUsgs ? formatDateTime(latestUsgs.time) : "Sin eventos recientes"}
          icon={<Activity className="size-4" aria-hidden="true" />}
        />
      </div>
      {!data.usgs.ok && (
        <p className="text-xs text-muted-foreground">La fuente en vivo (USGS) no respondió en esta actualización.</p>
      )}
      {!data.sgc.ok && (
        <p className="text-xs text-muted-foreground">El catálogo histórico (SGC) no respondió en esta actualización.</p>
      )}
    </div>
  )
}
