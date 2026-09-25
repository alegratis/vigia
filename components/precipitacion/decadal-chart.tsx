"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Bar, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import { AlertTriangle, CloudRain, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@/components/ui/chart"
import type { ClimatologiaDecadalResponse } from "@/lib/precipitacion/api-types"

export interface SelectedVereda {
  codigoVereda: string
  nombre: string
  municipio: string
}

/** The four municipios in the study area, selectable as a "whole territory" average. */
const MUNICIPIOS = ["Sevilla", "Zarzal", "Caicedonia", "Roldanillo"] as const
type Municipio = (typeof MUNICIPIOS)[number]

interface DecadalChartProps {
  /** Last vereda clicked on the map, if any — takes over the chart until a municipio tab is chosen instead. */
  vereda: SelectedVereda | null
}

const fetcher = async (url: string): Promise<ClimatologiaDecadalResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la climatología decadal")
  return res.json()
}

const CHART_CONFIG = {
  mmActual: { label: "Año en curso", color: "var(--chart-4)" },
} as const

/** Data key for a 10-year bin in chart rows/config, e.g. "bin_1994_2003". */
function binKey(inicio: number, fin: number) {
  return `bin_${inicio}_${fin}`
}

/** Data key for a recent individual year's line, e.g. "reciente_2025". */
function recienteKey(anio: number) {
  return `reciente_${anio}`
}

/** Color for a 10-year bin bar: three distinct hues (`--precipitacion-decada-1..3`), one per decade. */
function decadaColor(index: number) {
  return `var(--precipitacion-decada-${(index % 3) + 1})`
}

/** The two most recent individual years reuse the first two "historico" hues from the quinquenal histogram, for a consistent visual vocabulary across all three charts. */
function recienteColor(rankFromMostRecent: number) {
  return `var(--precipitacion-historico-${(rankFromMostRecent % 3) + 1})`
}

/**
 * First monthly rainfall chart above the precipitación map: replaces the
 * old IDEAM-normal histogram, which read from IDEAM's published
 * 1991-2020/1981-2010 climatology raster (visualizador.ideam.gov.co) —
 * a service that has been down, leaving that chart permanently empty.
 * This one computes its own monthly averages directly from Open-Meteo's
 * historical archive (the same source the quinquenal histogram below it
 * already uses) over three consecutive 10-year windows — a longer,
 * 30-year look back than the quinquenal chart's 5-year bins, at the cost
 * of finer within-window detail, so the two charts complement rather than
 * duplicate each other. The current year and the two years right before
 * it are left out of the bins and shown as individual lines instead (same
 * convention as the quinquenal chart: current year on by default with its
 * own switch, the two prior years off by default and individually
 * toggleable).
 *
 * Same two ways to choose what's plotted as the quinquenal chart: click a
 * vereda on the map, or pick a municipio tab for the whole-territory
 * average.
 */
export function DecadalChart({ vereda }: DecadalChartProps) {
  const [municipio, setMunicipio] = useState<Municipio>("Sevilla")
  const [showActual, setShowActual] = useState(true)
  // Off by default, same rationale as the quinquenal histogram's recent-year toggles.
  const [enabledYears, setEnabledYears] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<"vereda" | "municipio">("municipio")

  function toggleYear(anio: number, checked: boolean) {
    setEnabledYears((prev) => {
      const next = new Set(prev)
      if (checked) next.add(anio)
      else next.delete(anio)
      return next
    })
  }

  useEffect(() => {
    if (vereda) setMode("vereda")
  }, [vereda])

  const query =
    mode === "vereda" && vereda
      ? `/api/precipitacion/climatologia-decadal?codigoVereda=${encodeURIComponent(vereda.codigoVereda)}`
      : `/api/precipitacion/climatologia-decadal?municipio=${encodeURIComponent(municipio)}`

  const { data, error, isLoading, mutate, isValidating } = useSWR<ClimatologiaDecadalResponse>(query, fetcher, {
    revalidateOnFocus: false,
  })

  const decadas = data?.decadas ?? []
  const aniosRecientes = data?.aniosRecientes ?? []

  const chartData = useMemo(
    () =>
      (data?.meses ?? []).map((m) => {
        const binValues = Object.fromEntries(m.decadas.map((d) => [binKey(d.inicio, d.fin), d.mm]))
        const recienteValues = Object.fromEntries(m.reciente.map((r) => [recienteKey(r.anio), r.mm]))
        return {
          monthLabel: m.monthLabel,
          mmActual: m.mmActual,
          esMesEnCurso: m.esMesEnCurso,
          ...binValues,
          ...recienteValues,
        }
      }),
    [data],
  )
  const hasAnyData = chartData.some((m) => decadas.some((d) => (m as Record<string, unknown>)[binKey(d.inicio, d.fin)] != null))
  const currentYear = new Date().getFullYear()

  const chartConfig = useMemo(() => {
    const binConfig = Object.fromEntries(
      decadas.map((d, i) => [binKey(d.inicio, d.fin), { label: `${d.inicio}-${d.fin}`, color: decadaColor(i) }]),
    )
    const recienteConfig = Object.fromEntries(
      aniosRecientes.map((anio, rank) => [recienteKey(anio), { label: String(anio), color: recienteColor(rank) }]),
    )
    return { ...CHART_CONFIG, ...binConfig, ...recienteConfig }
  }, [decadas, aniosRecientes])

  return (
    <Card>
      <CardHeader className="gap-3 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CloudRain className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold tracking-tight">
              Histograma de lluvia por décadas —{" "}
              {mode === "vereda" && vereda
                ? `${vereda.nombre} (${vereda.municipio})`
                : `${municipio} (territorio completo)`}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isValidating}
            className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className={isValidating ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            Actualizar
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <fieldset>
            <legend className="sr-only">Territorio</legend>
            <ToggleGroup
              value={[mode === "municipio" ? municipio : ""]}
              onValueChange={(value) => {
                const next = value[0] as Municipio | undefined
                if (next) {
                  setMunicipio(next)
                  setMode("municipio")
                }
              }}
              variant="outline"
              size="sm"
              className="flex-wrap justify-start"
            >
              {MUNICIPIOS.map((m) => (
                <ToggleGroupItem key={m} value={m} aria-label={`Ver ${m} completo`}>
                  {m}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="sr-only">Años a mostrar</legend>
            <div className="flex items-center gap-2">
              <Switch id="show-actual-year-decadal" checked={showActual} onCheckedChange={setShowActual} />
              <Label htmlFor="show-actual-year-decadal" className="text-sm font-medium text-foreground">
                {currentYear} (año en curso)
              </Label>
            </div>
            {aniosRecientes.map((anio) => (
              <div key={anio} className="flex items-center gap-2">
                <Switch
                  id={`show-year-decadal-${anio}`}
                  checked={enabledYears.has(anio)}
                  onCheckedChange={(checked) => toggleYear(anio, checked)}
                />
                <Label htmlFor={`show-year-decadal-${anio}`} className="text-sm font-medium text-foreground">
                  {anio}
                </Label>
              </div>
            ))}
          </fieldset>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "vereda" && vereda
            ? "Open-Meteo — promedios mensuales por década en el centroide de la vereda seleccionada."
            : `Open-Meteo — promedios mensuales por década, promediados entre las ${data?.ubicacion.veredasPromediadas ?? ""} veredas rurales de ${municipio}.`}
          {showActual && " Línea: acumulado real de este año (Open-Meteo)."}
          {enabledYears.size > 0 &&
            ` Comparando con ${[...enabledYears].sort((a, b) => b - a).join(", ")} (acumulado completo del año, Open-Meteo).`}
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : error || !data ? (
          <div className="flex flex-col items-start gap-3 py-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" aria-hidden="true" />
              <p className="font-medium">No se pudo cargar el histograma</p>
            </div>
            <p className="text-sm text-muted-foreground">El servicio de Open-Meteo podría no estar disponible en este momento.</p>
            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : hasAnyData ? (
          <ChartContainer config={chartConfig} className="h-[320px] w-full">
            <ComposedChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={40}
                label={{ value: "mm", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const row = payload[0].payload as (typeof chartData)[number]
                  return (
                    <div className="grid min-w-48 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                      <p className="font-medium text-foreground">{label}</p>
                      <div className="grid gap-1">
                        {decadas.map((d) => {
                          const key = binKey(d.inicio, d.fin)
                          const mm = (row as unknown as Record<string, number | null>)[key]
                          if (mm == null) return null
                          return (
                            <TooltipRow
                              key={key}
                              color={`var(--color-${key})`}
                              label={`${d.inicio}-${d.fin}`}
                              value={`${mm} mm`}
                            />
                          )
                        })}
                        {showActual && row.mmActual != null && (
                          <TooltipRow
                            swatchClassName="rounded-full"
                            color="var(--color-mmActual)"
                            label={CHART_CONFIG.mmActual.label}
                            value={`${row.mmActual} mm${row.esMesEnCurso ? " (mes en curso, parcial)" : ""}`}
                          />
                        )}
                        {aniosRecientes
                          .filter((anio) => enabledYears.has(anio))
                          .map((anio) => {
                            const key = recienteKey(anio)
                            const mm = (row as unknown as Record<string, number | null>)[key]
                            if (mm == null) return null
                            return (
                              <TooltipRow
                                key={anio}
                                swatchClassName="rounded-full"
                                color={`var(--color-${key})`}
                                label={String(anio)}
                                value={`${mm} mm`}
                              />
                            )
                          })}
                      </div>
                    </div>
                  )
                }}
              />
              {decadas.map((d) => {
                const key = binKey(d.inicio, d.fin)
                return <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[3, 3, 0, 0]} />
              })}
              {showActual && (
                <Line
                  dataKey="mmActual"
                  stroke="var(--color-mmActual)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-mmActual)" }}
                  connectNulls
                />
              )}
              {aniosRecientes.map((anio) => {
                if (!enabledYears.has(anio)) return null
                const key = recienteKey(anio)
                return (
                  <Line
                    key={anio}
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: `var(--color-${key})` }}
                    connectNulls
                  />
                )
              })}
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Open-Meteo no tiene datos históricos suficientes para este punto exacto.
          </p>
        )}
        <p className="mt-3 text-xs leading-snug text-muted-foreground">
          Cada barra es el promedio mensual de{" "}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Open-Meteo
          </a>{" "}
          (análisis ECMWF IFS y reanálisis ERA5) a lo largo de una década completa — 10 años, para una mirada
          más larga al pasado (30 años en total) que el histograma de quinquenios abajo; cada década tiene su
          propio color, en orden cronológico según la leyenda. El año {currentYear} y los dos anteriores se
          dejan fuera de las barras a propósito y se muestran como líneas individuales (misma convención que
          el histograma de quinquenios) para no diluir la comparación más reciente dentro de un promedio.
        </p>
      </CardContent>
    </Card>
  )
}

/** One labeled value in the histogram's hover tooltip, with a color swatch matching the chart series it reads from. */
function TooltipRow({
  color,
  label,
  value,
  swatchClassName = "rounded-[2px]",
}: {
  color: string
  label: string
  value: string
  swatchClassName?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`size-2.5 shrink-0 ${swatchClassName}`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-auto font-mono font-medium text-foreground">{value}</span>
    </div>
  )
}
