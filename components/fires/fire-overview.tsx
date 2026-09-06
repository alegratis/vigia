"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  AlertTriangle,
  Flame,
  KeyRound,
  MapPin,
  RefreshCw,
  Satellite,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  confidenceStyle,
  formatDateTime,
  formatDistance,
  formatFrp,
} from "@/lib/firms/ui"
import type { FiresResponse, FiresErrorResponse } from "@/lib/firms/api-types"

class FiresError extends Error {
  needsConfig: boolean
  constructor(message: string, needsConfig: boolean) {
    super(message)
    this.needsConfig = needsConfig
  }
}

const fetcher = async (url: string): Promise<FiresResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    let payload: FiresErrorResponse | null = null
    try {
      payload = (await res.json()) as FiresErrorResponse
    } catch {
      // ignore parse failure
    }
    throw new FiresError(
      payload?.error ?? "No se pudo cargar el panel de incendios",
      payload?.needsConfig ?? false,
    )
  }
  return res.json()
}

const DAY_OPTIONS = [1, 2, 3, 5] as const

export function FireOverview() {
  const [days, setDays] = useState<number>(2)
  const { data, error, isLoading, mutate, isValidating } = useSWR<
    FiresResponse,
    FiresError
  >(`/api/incendios?days=${days}`, fetcher, { revalidateOnFocus: false })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  if (error?.needsConfig) {
    return (
      <Card className="border-[var(--chart-3)]/50">
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <div className="flex items-center gap-2 text-foreground">
            <KeyRound className="size-5 text-[var(--chart-3)]" aria-hidden="true" />
            <p className="font-medium">Configuración requerida</p>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {error.message}
          </p>
          <a
            href="https://firms.modaps.eosdis.nasa.gov/api/map_key/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Obtener clave gratuita de NASA FIRMS
          </a>
        </CardContent>
      </Card>
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
            {error?.message ??
              "El servicio NASA FIRMS podría no estar disponible en este momento."}
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

  const { summary } = data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Actualizado {formatDateTime(data.generatedAt)} · {summary.total} focos ·
          últimos {data.dayRange}{" "}
          {data.dayRange === 1 ? "día" : "días"}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Periodo
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? "día" : "días"}
                </option>
              ))}
            </select>
          </label>
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
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Focos detectados"
          value={String(summary.total)}
          icon={<Flame className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Confianza alta"
          value={String(summary.highConfidence)}
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="FRP máxima"
          value={formatFrp(summary.maxFrp)}
          icon={<Flame className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Último foco"
          value={summary.latestAt ? formatDateTime(summary.latestAt) : "—"}
          icon={<Satellite className="size-4" aria-hidden="true" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summary.byMunicipality.map((m) => (
          <Card key={m.name}>
            <CardContent className="flex items-center justify-between gap-2 py-4">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">{m.name}</span>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums">{m.count}</p>
                <p className="text-xs text-muted-foreground">
                  {m.highConfidence} de confianza alta
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DetectionsTable detections={data.detections} />

      {data.sourcesFailed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Fuentes sin respuesta: {data.sourcesFailed.map((s) => s.source).join(", ")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Fuente: NASA FIRMS ({data.sourcesQueried.join(", ")}). Detecciones satelitales
        VIIRS de 375 m; no reemplazan la verificación en campo.
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
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

function DetectionsTable({ detections }: { detections: FiresResponse["detections"] }) {
  if (detections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Flame className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Sin focos activos</p>
          <p className="max-w-md text-sm text-muted-foreground">
            No se detectaron focos de calor en el área de estudio para el periodo
            seleccionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  const rows = detections.slice(0, 100)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <h2 className="font-semibold tracking-tight">Detecciones recientes</h2>
        <p className="text-sm text-muted-foreground">
          {detections.length > rows.length
            ? `Mostrando ${rows.length} de ${detections.length} focos`
            : `${detections.length} focos`}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Cerca de</th>
                <th className="px-4 py-2 font-medium">Confianza</th>
                <th className="px-4 py-2 text-right font-medium">FRP</th>
                <th className="px-4 py-2 font-medium">Satélite</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const cs = confidenceStyle(d.confidence)
                return (
                  <tr
                    key={d.id}
                    className="border-b border-border/60 last:border-0 hover:bg-accent/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                      {formatDateTime(d.acquiredAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {d.nearest.name}
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatDistance(d.nearest.distanceKm)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: cs.color }}
                          aria-hidden="true"
                        />
                        {cs.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                      {formatFrp(d.frp)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                      {d.satellite}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
