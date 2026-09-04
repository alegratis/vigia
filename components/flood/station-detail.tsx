"use client"

import useSWR from "swr"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LevelBadge } from "@/components/flood/level-badge"
import { Hydrograph } from "@/components/flood/hydrograph"
import { RETURN_PERIODS } from "@/lib/geoglows/gumbel"
import { formatDateTime, formatFlow, formatLeadTime, levelStyle } from "@/lib/flood-ui"
import type { ReachAssessmentResponse } from "@/lib/geoglows/api-types"

const fetcher = async (url: string): Promise<ReachAssessmentResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "No se pudo evaluar el tramo")
  }
  return res.json()
}

export function StationDetail({ reachId }: { reachId: number }) {
  const { data, error, isLoading, mutate, isValidating } =
    useSWR<ReachAssessmentResponse>(`/api/reaches/${reachId}`, fetcher, {
      revalidateOnFocus: false,
    })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
            <p className="font-medium">No se pudo cargar el pronóstico</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LevelBadge level={data.current.level.key} size="lg" />
          <p className="text-sm text-muted-foreground">
            Actualizado {formatDateTime(data.generatedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw
            className={isValidating ? "size-4 animate-spin" : "size-4"}
            aria-hidden="true"
          />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Caudal actual" value={formatFlow(data.current.flow)} levelKey={data.current.level.key} />
        <MetricCard
          label="Pico previsto"
          value={formatFlow(data.peak.flow)}
          sub={formatDateTime(data.peak.datetime)}
          levelKey={data.peak.level.key}
        />
        <MetricCard
          label="Peor escenario"
          value={formatFlow(data.peakUpper.flow)}
          sub="Límite superior"
          levelKey={data.peakUpper.level.key}
        />
        <MetricCard
          label="Cruce de vigilancia"
          value={
            data.medianExceedance
              ? formatLeadTime(data.medianExceedance.leadTimeHours)
              : "Sin cruce"
          }
          sub={
            data.medianExceedance ? formatDateTime(data.medianExceedance.datetime) : "próx. 15 días"
          }
        />
      </div>

      <Card>
        <CardHeader className="gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Hidrograma de pronóstico</h2>
          <p className="text-sm text-muted-foreground">
            Caudal mediano y banda de incertidumbre (m³/s) frente a los umbrales de
            periodo de retorno para los próximos 15 días.
          </p>
        </CardHeader>
        <CardContent>
          <Hydrograph series={data.series} thresholds={data.thresholds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Umbrales de periodo de retorno</h2>
          <p className="text-sm text-muted-foreground">
            Calculados con distribución Gumbel sobre el registro histórico diario
            (GEOGLOWS, 1940–presente).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Periodo de retorno</th>
                  <th className="pb-2 pr-4 font-medium">Nivel asociado</th>
                  <th className="pb-2 text-right font-medium">Caudal umbral</th>
                </tr>
              </thead>
              <tbody>
                {RETURN_PERIODS.map((rp) => {
                  const value = data.thresholds[rp]
                  return (
                    <tr key={rp} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 tabular-nums">{rp} años</td>
                      <td className="py-2 pr-4">
                        <ThresholdLevel rp={rp} />
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {value != null ? formatFlow(value) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  levelKey,
}: {
  label: string
  value: string
  sub?: string
  levelKey?: Parameters<typeof levelStyle>[0]
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="flex items-center gap-2 text-lg font-semibold tabular-nums">
          {levelKey && (
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: levelStyle(levelKey).color }}
              aria-hidden="true"
            />
          )}
          {value}
        </span>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  )
}

const RP_TO_LEVEL: Record<number, Parameters<typeof levelStyle>[0]> = {
  2: "vigilancia",
  5: "alerta",
  10: "alerta_alta",
  25: "emergencia",
  50: "extrema",
  100: "extrema",
}

function ThresholdLevel({ rp }: { rp: number }) {
  const level = RP_TO_LEVEL[rp] ?? "extrema"
  return <LevelBadge level={level} />
}
