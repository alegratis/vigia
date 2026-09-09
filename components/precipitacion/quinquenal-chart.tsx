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
import type { ClimatologiaQuinquenalResponse } from "@/lib/precipitacion/api-types"
import type { SelectedVereda } from "@/components/precipitacion/climatology-chart"

/** The three municipios in the study area, selectable as a "whole territory" average. */
const MUNICIPIOS = ["Sevilla", "Zarzal", "Caicedonia"] as const
type Municipio = (typeof MUNICIPIOS)[number]

interface QuinquenalChartProps {
  /** Last vereda clicked on the map, if any — takes over the chart until a municipio tab is chosen instead. */
  vereda: SelectedVereda | null
}

const fetcher = async (url: string): Promise<ClimatologiaQuinquenalResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la climatología quinquenal")
  return res.json()
}

const CHART_CONFIG = {
  mmActual: { label: "Año en curso", color: "var(--chart-4)" },
} as const

/** Data key for a 5-year bin in chart rows/config, e.g. "bin_1999_2003". */
function binKey(inicio: number, fin: number) {
  return `bin_${inicio}_${fin}`
}

/** Data key for a recent individual year's line, e.g. "reciente_2025". */
function recienteKey(anio: number) {
  return `reciente_${anio}`
}

/**
 * Color for a 5-year bin bar: one amber hue (`--precipitacion-quinquenio`)
 * at increasing opacity from the oldest bin to the newest, via color-mix —
 * a sequential ramp, which (unlike the year *lines* on the other
 * histogram) fits this data naturally since the bins really are one
 * chronological sequence rather than several interchangeable series
 * sharing a hue.
 */
function quinquenioColor(index: number, total: number) {
  if (total <= 1) return "var(--precipitacion-quinquenio)"
  const minOpacity = 35
  const maxOpacity = 100
  const opacity = Math.round(minOpacity + ((maxOpacity - minOpacity) * index) / (total - 1))
  return `color-mix(in oklch, var(--precipitacion-quinquenio) ${opacity}%, transparent)`
}

/** The two most recent individual years reuse the first two "historico" hues from the other histogram, for a consistent visual vocabulary across both charts. */
function recienteColor(rankFromMostRecent: number) {
  return `var(--precipitacion-historico-${(rankFromMostRecent % 3) + 1})`
}

/**
 * Second monthly rainfall chart below the precipitación map: instead of
 * IDEAM's two 30-year normal periods (see ClimatologyChart above it), this
 * one computes its own monthly averages directly from Open-Meteo's
 * historical archive over consecutive 5-year windows starting in 1999
 * (see lib/precipitacion/openmeteo-quinquenal-climatology.ts) — one bar
 * per window, shaded from lightest (oldest) to most saturated (newest) so
 * a viewer can see whether rainfall for a given month has been trending up
 * or down across recent 5-year spans, something a single multi-decade
 * normal smooths away. The current year and the two years right before it
 * are deliberately left out of the bins and shown as individual lines
 * instead (same convention as the other histogram: current year on by
 * default with its own switch, the two prior years off by default and
 * individually toggleable), since folding still-fresh years into a 5-year
 * average would blend away the exact recent-year comparison a viewer is
 * usually after.
 *
 * Same two ways to choose what's plotted as the other histogram: click a
 * vereda on the map, or pick a municipio tab for the whole-territory
 * average.
 */
export function QuinquenalChart({ vereda }: QuinquenalChartProps) {
  const [municipio, setMunicipio] = useState<Municipio>("Sevilla")
  const [showActual, setShowActual] = useState(true)
  // Off by default, same rationale as the other histogram's recent-year toggles: two extra lines on top
  // of the bin bars and the current-year line would clutter the chart before anyone's asked for a
  // specific year to compare against.
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
      ? `/api/precipitacion/climatologia-quinquenal?codigoVereda=${encodeURIComponent(vereda.codigoVereda)}`
      : `/api/precipitacion/climatologia-quinquenal?municipio=${encodeURIComponent(municipio)}`

  const { data, error, isLoading, mutate, isValidating } = useSWR<ClimatologiaQuinquenalResponse>(query, fetcher, {
    revalidateOnFocus: false,
  })

  const quinquenios = data?.quinquenios ?? []
  const aniosRecientes = data?.aniosRecientes ?? []

  const chartData = useMemo(
    () =>
      (data?.meses ?? []).map((m) => {
        const binValues = Object.fromEntries(m.quinquenios.map((q) => [binKey(q.inicio, q.fin), q.mm]))
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
  const hasAnyData = chartData.some((m) => quinquenios.some((q) => (m as Record<string, unknown>)[binKey(q.inicio, q.fin)] != null))
  const currentYear = new Date().getFullYear()

  const chartConfig = useMemo(() => {
    const binConfig = Object.fromEntries(
      quinquenios.map((q, i) => [
        binKey(q.inicio, q.fin),
        { label: `${q.inicio}-${q.fin}`, color: quinquenioColor(i, quinquenios.length) },
      ]),
    )
    const recienteConfig = Object.fromEntries(
      aniosRecientes.map((anio, rank) => [recienteKey(anio), { label: String(anio), color: recienteColor(rank) }]),
    )
    return { ...CHART_CONFIG, ...binConfig, ...recienteConfig }
  }, [quinquenios, aniosRecientes])

  return (
    <Card>
      <CardHeader className="gap-3 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CloudRain className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold tracking-tight">
              Histograma de lluvia por quinquenios —{" "}
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
              <Switch id="show-actual-year-quinquenal" checked={showActual} onCheckedChange={setShowActual} />
              <Label htmlFor="show-actual-year-quinquenal" className="text-sm font-medium text-foreground">
                {currentYear} (año en curso)
              </Label>
            </div>
            {aniosRecientes.map((anio) => (
              <div key={anio} className="flex items-center gap-2">
                <Switch
                  id={`show-year-quinquenal-${anio}`}
                  checked={enabledYears.has(anio)}
                  onCheckedChange={(checked) => toggleYear(anio, checked)}
                />
                <Label htmlFor={`show-year-quinquenal-${anio}`} className="text-sm font-medium text-foreground">
                  {anio}
                </Label>
              </div>
            ))}
          </fieldset>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "vereda" && vereda
            ? "Open-Meteo — promedios mensuales por quinquenio en el centroide de la vereda seleccionada."
            : `Open-Meteo — promedios mensuales por quinquenio, promediados entre las ${data?.ubicacion.veredasPromediadas ?? ""} veredas rurales de ${municipio}.`}
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
                        {quinquenios.map((q) => {
                          const key = binKey(q.inicio, q.fin)
                          const mm = (row as unknown as Record<string, number | null>)[key]
                          if (mm == null) return null
                          return (
                            <TooltipRow
                              key={key}
                              color={`var(--color-${key})`}
                              label={`${q.inicio}-${q.fin}`}
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
              {quinquenios.map((q) => {
                const key = binKey(q.inicio, q.fin)
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
          (análisis ECMWF IFS y reanálisis ERA5) a lo largo de un quinquenio completo — 5 años, no 30 como en
          el histograma de IDEAM arriba — para ver si un mes viene subiendo o bajando en años recientes, algo
          que una sola normal de varias décadas puede ocultar; el tono más intenso marca el quinquenio más
          reciente. El año {currentYear} y los dos anteriores se dejan fuera de las barras a propósito y se
          muestran como líneas individuales (misma convención que el otro histograma) para no diluir la
          comparación más reciente dentro de un promedio.
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
