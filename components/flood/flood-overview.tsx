"use client"

import useSWR from "swr"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, Clock, RefreshCw, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LevelBadge } from "@/components/flood/level-badge"
import { formatDateTime, formatFlow, formatLeadTime, levelStyle } from "@/lib/flood-ui"
import type { OverviewResponse, OverviewStation } from "@/lib/geoglows/api-types"

const fetcher = async (url: string): Promise<OverviewResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar el panel de inundaciones")
  return res.json()
}

export function FloodOverview() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<OverviewResponse>(
    "/api/overview",
    fetcher,
    { revalidateOnFocus: false },
  )

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
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
            <p className="font-medium">No se pudo cargar la información</p>
          </div>
          <p className="text-sm text-muted-foreground">
            El servicio GEOGLOWS podría no estar disponible en este momento.
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Actualizado {formatDateTime(data.generatedAt)} · {data.count} estaciones
          monitoreadas
        </p>
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {data.stations.map((s) => (
          <StationSummaryCard key={s.station.slug} entry={s} />
        ))}
      </div>
    </div>
  )
}

function StationSummaryCard({ entry }: { entry: OverviewStation }) {
  const { station } = entry

  if (!entry.ok) {
    return (
      <Card className="opacity-90">
        <CardHeader className="gap-1">
          <h3 className="font-semibold tracking-tight">{station.name}</h3>
          <p className="text-sm text-muted-foreground">{station.municipality}</p>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {entry.error}
          </p>
        </CardContent>
      </Card>
    )
  }

  const accent = levelStyle(entry.current.level.key).color

  return (
    <Link
      href={`/inundaciones/${station.slug}`}
      className="group focus-visible:outline-none"
    >
      <Card className="h-full overflow-hidden transition-colors hover:border-foreground/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <span className="block h-1 w-full" style={{ backgroundColor: accent }} aria-hidden="true" />
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-semibold tracking-tight">{station.river}</h3>
              <p className="text-sm text-muted-foreground">{station.municipality}</p>
            </div>
            <ArrowUpRight
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden="true"
            />
          </div>
          <LevelBadge level={entry.current.level.key} size="lg" className="self-start" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Caudal actual</span>
            <span className="font-semibold tabular-nums">
              {formatFlow(entry.current.flow)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              Pico previsto
            </span>
            <span className="tabular-nums">{formatFlow(entry.peak.flow)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              Umbral de vigilancia
            </span>
            <span className="tabular-nums">
              {entry.medianExceedance
                ? formatLeadTime(entry.medianExceedance.leadTimeHours)
                : "sin cruce"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
