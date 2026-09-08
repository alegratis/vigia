"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { AlertTriangle, CloudRain, Droplet, MapPin, Percent, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PRECIPITATION_LEVEL_STYLES } from "@/lib/precipitacion/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import {
  ACCUMULATION_WINDOW_OPTIONS,
  FORECAST_WINDOW_OPTIONS,
  type PrecipitacionAmenazaResponse,
  type PrecipitacionMode,
} from "@/lib/precipitacion/api-types"

const fetcher = async (url: string): Promise<PrecipitacionAmenazaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar el panel de precipitación")
  return res.json()
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface MunicipioSummary {
  municipio: string
  avgMm: number
  wettest: { nombre: string; acumuladoMm: number } | null
  count: number
  /** Forecast mode only: average of each vereda's max daily precipitation probability (%). */
  avgProbabilidad: number | null
}

export function PrecipitationOverview() {
  const [mode, setMode] = useState<PrecipitacionMode>("historico")
  const [windowDays, setWindowDays] = useState<number>(7)
  const windowOptions = mode === "pronostico" ? FORECAST_WINDOW_OPTIONS : ACCUMULATION_WINDOW_OPTIONS

  function handleModeChange(nextMode: PrecipitacionMode) {
    setMode(nextMode)
    const nextOptions = nextMode === "pronostico" ? FORECAST_WINDOW_OPTIONS : ACCUMULATION_WINDOW_OPTIONS
    if (!(nextOptions as readonly number[]).includes(windowDays)) {
      setWindowDays(7)
    }
  }

  const { data, error, isLoading, mutate, isValidating } = useSWR<PrecipitacionAmenazaResponse>(
    `/api/precipitacion/amenaza?mode=${mode}&window=${windowDays}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  const summaries = useMemo<MunicipioSummary[]>(() => {
    if (!data) return []
    const byMunicipio = new Map<
      string,
      { sum: number; count: number; wettest: { nombre: string; acumuladoMm: number } | null; probSum: number; probCount: number }
    >()
    for (const f of data.veredas.features) {
      const { municipio, acumuladoMm, nombre, probabilidadMax } = f.properties
      if (acumuladoMm == null) continue
      const entry = byMunicipio.get(municipio) ?? { sum: 0, count: 0, wettest: null, probSum: 0, probCount: 0 }
      entry.sum += acumuladoMm
      entry.count += 1
      if (probabilidadMax != null) {
        entry.probSum += probabilidadMax
        entry.probCount += 1
      }
      if (!entry.wettest || acumuladoMm > entry.wettest.acumuladoMm) {
        entry.wettest = { nombre, acumuladoMm }
      }
      byMunicipio.set(municipio, entry)
    }
    return Array.from(byMunicipio.entries())
      .map(([municipio, e]) => ({
        municipio,
        avgMm: e.sum / e.count,
        wettest: e.wettest,
        count: e.count,
        avgProbabilidad: e.probCount > 0 ? e.probSum / e.probCount : null,
      }))
      .sort((a, b) => a.municipio.localeCompare(b.municipio))
  }, [data])

  const levelCounts = useMemo(() => {
    if (!data) return null
    const counts: Record<string, number> = {}
    for (const f of data.veredas.features) {
      if (f.properties.nivel) counts[f.properties.nivel] = (counts[f.properties.nivel] ?? 0) + 1
    }
    return counts
  }, [data])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-xl" />
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
            {mode === "pronostico"
              ? "El servicio Open-Meteo podría no estar disponible en este momento."
              : "El servicio NASA POWER podría no estar disponible en este momento."}
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

  const avgLabel = mode === "pronostico" ? `Pronóstico ${windowDays} días` : `Promedio ${windowDays} días`
  const dateLabel = mode === "pronostico" ? `pronóstico generado el ${data.windowEnd}` : `acumulado hasta el ${data.windowEnd}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border p-0.5 text-sm" role="group" aria-label="Modo de datos">
          <button
            type="button"
            onClick={() => handleModeChange("historico")}
            aria-pressed={mode === "historico"}
            className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
              mode === "historico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Histórico
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("pronostico")}
            aria-pressed={mode === "pronostico"}
            className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
              mode === "pronostico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pronóstico
          </button>
        </div>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          aria-label="Ventana de días"
          className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground"
        >
          {windowOptions.map((d) => (
            <option key={d} value={d}>
              {d} días
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          className="ml-auto inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={isValidating ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Actualizado {formatDateTime(data.generatedAt)} · {data.veredas.features.length} veredas · {dateLabel}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaries.map((s) => (
          <Card key={s.municipio}>
            <CardHeader className="gap-1">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="font-semibold tracking-tight">{s.municipio}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{s.count} veredas con datos</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Droplet className="size-3.5" aria-hidden="true" />
                  {avgLabel}
                </span>
                <span className="font-semibold tabular-nums">{s.avgMm.toFixed(1)} mm</span>
              </div>
              {mode === "pronostico" && s.avgProbabilidad != null && (
                <div className="flex items-baseline justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Percent className="size-3.5" aria-hidden="true" />
                    Probabilidad promedio
                  </span>
                  <span className="font-semibold tabular-nums">{s.avgProbabilidad.toFixed(0)}%</span>
                </div>
              )}
              {s.wettest && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CloudRain className="size-3.5" aria-hidden="true" />
                    Vereda más lluviosa
                  </span>
                  <span className="text-right tabular-nums">
                    {s.wettest.nombre} · {s.wettest.acumuladoMm.toFixed(1)} mm
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {levelCounts && <LevelBreakdown counts={levelCounts} />}
    </div>
  )
}

function LevelBreakdown({ counts }: { counts: Record<string, number> }) {
  return (
    <Card>
      <CardHeader className="border-b border-border">
        <h2 className="font-semibold tracking-tight">Veredas por nivel de acumulación</h2>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-4 py-4">
        {Object.entries(PRECIPITATION_LEVEL_STYLES).map(([level, style]) => (
          <div key={level} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: resolveCssColor(style.colorToken) }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{level}</span>
            <span className="font-semibold tabular-nums">{counts[level] ?? 0}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
