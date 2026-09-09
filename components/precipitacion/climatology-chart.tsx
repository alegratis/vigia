"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Bar, ComposedChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import { AlertTriangle, CloudRain, MapPin, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@/components/ui/chart"
import type { ClimatologiaResponse } from "@/lib/precipitacion/api-types"

export interface SelectedVereda {
  codigoVereda: string
  nombre: string
  municipio: string
}

/** The three municipios in the study area, selectable as a "whole territory" average. */
const MUNICIPIOS = ["Sevilla", "Zarzal", "Caicedonia"] as const
type Municipio = (typeof MUNICIPIOS)[number]

interface ClimatologyChartProps {
  /** Last vereda clicked on the map, if any — takes over the chart until a municipio tab is chosen instead. */
  vereda: SelectedVereda | null
}

const fetcher = async (url: string): Promise<ClimatologiaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la climatología")
  return res.json()
}

const CHART_CONFIG = {
  mm1991_2020: { label: "Normal 1991-2020", color: "var(--chart-1)" },
  mm1981_2010: { label: "Normal 1981-2010", color: "var(--chart-2)" },
  mmActual: { label: "Año en curso", color: "var(--chart-4)" },
} as const

/**
 * Data key for a past year's line in chart rows/config, e.g. "hist_2025" —
 * prefixed since object keys can't be bare numbers and Recharts/ChartConfig
 * both key off these strings.
 */
function historicoKey(anio: number) {
  return `hist_${anio}`
}

/**
 * Color for a past year's line: the single `--precipitacion-historico`
 * violet at a rank-based opacity (most recent year most opaque, via
 * color-mix) so the three comparison lines read as one family without
 * introducing three separate color tokens.
 */
function historicoColor(rankFromMostRecent: number) {
  const opacity = [100, 65, 40][rankFromMostRecent] ?? 40
  return `color-mix(in oklch, var(--precipitacion-historico) ${opacity}%, transparent)`
}

/** Dash pattern for a past year's line, paired with historicoColor's opacity ladder as a colorblind-safe secondary cue. */
function historicoDash(rankFromMostRecent: number): string | undefined {
  return [undefined, "6 4", "2 3"][rankFromMostRecent]
}

/**
 * Monthly rainfall chart below the precipitación map: two bars for IDEAM's
 * published normal periods (see lib/precipitacion/ideam-climatology.ts),
 * plus an optional line for this calendar year's actual accumulation
 * (Open-Meteo's historical archive — see
 * openmeteo-historical-client.ts's getCurrentYearMonthlyPrecipitation —
 * chosen over NASA POWER's satellite-derived near-real-time layer, which
 * was observed overestimating rainfall in this terrain), so a viewer can
 * see whether the current year is running above or below normal for a
 * given month. Individually toggleable lines for each of the three most
 * recently completed calendar years (getRecentPastYears — e.g. 2025, 2024,
 * 2023) are also available, off by default, for comparing specific recent
 * years against each other or against the current year rather than only
 * against the multi-decade IDEAM normal.
 *
 * Two ways to choose what's plotted:
 * - Click a vereda on the map (bubbles up via onVeredaSelect) — shows that
 *   single vereda's centroid climatology.
 * - Pick one of the three municipio tabs — shows the average of every
 *   rural vereda centroid in that municipio, i.e. the whole territory
 *   rather than one point. Sevilla is selected by default so the chart
 *   always has something to show even before any vereda is clicked.
 *
 * Clicking a vereda switches the tabs over to it (there's no vereda tab to
 * highlight, so the vereda name takes over the header); picking a
 * municipio tab afterward switches back to the whole-territory average.
 */
export function ClimatologyChart({ vereda }: ClimatologyChartProps) {
  const [municipio, setMunicipio] = useState<Municipio>("Sevilla")
  const [showActual, setShowActual] = useState(true)
  // Off by default — three extra lines on top of the two normal bars and the current-year line would
  // clutter the chart before anyone's asked for a specific year to compare against.
  const [enabledYears, setEnabledYears] = useState<Set<number>>(new Set())
  // Vereda selection takes over the chart the moment one is clicked; remember whether that's currently
  // in effect so a later municipio-tab click can explicitly hand control back.
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
      ? `/api/precipitacion/climatologia?codigoVereda=${encodeURIComponent(vereda.codigoVereda)}`
      : `/api/precipitacion/climatologia?municipio=${encodeURIComponent(municipio)}`

  const { data, error, isLoading, mutate, isValidating } = useSWR<ClimatologiaResponse>(query, fetcher, {
    revalidateOnFocus: false,
  })

  const aniosHistoricos = data?.aniosHistoricos ?? []

  const chartData = useMemo(
    () =>
      (data?.meses ?? []).map((m) => {
        const historicoValues = Object.fromEntries(m.historico.map((h) => [historicoKey(h.anio), h.mm]))
        return {
          monthLabel: m.monthLabel,
          mm1991_2020: m.mm1991_2020,
          rango1991_2020: m.rango1991_2020,
          mm1981_2010: m.mm1981_2010,
          rango1981_2010: m.rango1981_2010,
          mmActual: m.mmActual,
          esMesEnCurso: m.esMesEnCurso,
          ...historicoValues,
        }
      }),
    [data],
  )
  const hasAnyData = chartData.some((m) => m.mm1991_2020 != null || m.mm1981_2010 != null)
  const currentYear = new Date().getFullYear()

  const chartConfig = useMemo(() => {
    const historicoConfig = Object.fromEntries(
      aniosHistoricos.map((anio, rank) => [
        historicoKey(anio),
        { label: String(anio), color: historicoColor(rank) },
      ]),
    )
    return { ...CHART_CONFIG, ...historicoConfig }
  }, [aniosHistoricos])

  return (
    <Card>
      <CardHeader className="gap-3 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold tracking-tight">
              Histograma de lluvia normal —{" "}
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
              <Switch id="show-actual-year" checked={showActual} onCheckedChange={setShowActual} />
              <Label htmlFor="show-actual-year" className="text-sm font-medium text-foreground">
                {currentYear} (año en curso)
              </Label>
            </div>
            {aniosHistoricos.map((anio) => (
              <div key={anio} className="flex items-center gap-2">
                <Switch
                  id={`show-year-${anio}`}
                  checked={enabledYears.has(anio)}
                  onCheckedChange={(checked) => toggleYear(anio, checked)}
                />
                <Label htmlFor={`show-year-${anio}`} className="text-sm font-medium text-foreground">
                  {anio}
                </Label>
              </div>
            ))}
          </fieldset>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "vereda" && vereda
            ? "IDEAM — normales mensuales interpoladas en el centroide de la vereda seleccionada."
            : `IDEAM — normales mensuales promediadas entre las ${data?.ubicacion.veredasPromediadas ?? ""} veredas rurales de ${municipio}.`}
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
            <p className="text-sm text-muted-foreground">
              El servicio de climatología de IDEAM (visualizador.ideam.gov.co) o Open-Meteo podría no estar
              disponible en este momento.
            </p>
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
                        {row.mm1991_2020 != null && (
                          <TooltipRow
                            color="var(--color-mm1991_2020)"
                            label={CHART_CONFIG.mm1991_2020.label}
                            value={
                              row.rango1991_2020
                                ? `${row.rango1991_2020} (aprox. ${row.mm1991_2020} mm)`
                                : `${row.mm1991_2020} mm`
                            }
                          />
                        )}
                        {row.mm1981_2010 != null && (
                          <TooltipRow
                            color="var(--color-mm1981_2010)"
                            label={CHART_CONFIG.mm1981_2010.label}
                            value={
                              row.rango1981_2010
                                ? `${row.rango1981_2010} (aprox. ${row.mm1981_2010} mm)`
                                : `${row.mm1981_2010} mm`
                            }
                          />
                        )}
                        {showActual && row.mmActual != null && (
                          <TooltipRow
                            swatchClassName="rounded-full"
                            color="var(--color-mmActual)"
                            label={CHART_CONFIG.mmActual.label}
                            value={`${row.mmActual} mm${row.esMesEnCurso ? " (mes en curso, parcial)" : ""}`}
                          />
                        )}
                        {aniosHistoricos
                          .filter((anio) => enabledYears.has(anio))
                          .map((anio) => {
                            const key = historicoKey(anio)
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
              <Bar dataKey="mm1991_2020" fill="var(--color-mm1991_2020)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="mm1981_2010" fill="var(--color-mm1981_2010)" radius={[3, 3, 0, 0]} />
              {showActual && (
                <Line
                  dataKey="mmActual"
                  stroke="var(--color-mmActual)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--color-mmActual)" }}
                  connectNulls
                />
              )}
              {aniosHistoricos.map((anio, rank) => {
                if (!enabledYears.has(anio)) return null
                const key = historicoKey(anio)
                return (
                  <Line
                    key={anio}
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                    strokeDasharray={historicoDash(rank)}
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
            IDEAM no tiene un valor de climatología publicado para este punto exacto.
          </p>
        )}
        <p className="mt-3 text-xs leading-snug text-muted-foreground">
          Cada barra es el punto medio de la banda de precipitación mensual del{" "}
          <a
            href="https://visualizador.ideam.gov.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            mapa de climatología interpolada de IDEAM
          </a>
          , no la lectura exacta de una estación individual (ver el rango original al pasar el cursor) — a
          diferencia del histograma de una sola estación (por ejemplo, Cumbarco en Sevilla), esta versión cubre
          cualquier vereda o municipio del área de estudio. La línea de {currentYear}, cuando está activa, es el
          acumulado real de{" "}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Open-Meteo
          </a>{" "}
          (análisis ECMWF IFS y reanálisis ERA5, que asimilan observaciones reales de estaciones y no solo
          imágenes satelitales) para cada mes transcurrido; el mes en curso es un acumulado parcial (no cierra
          hasta fin de mes), y los meses futuros del año no se dibujan. Las líneas de años anteriores, cuando
          están activas, son el acumulado completo de esa misma fuente para cada mes de ese año.
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
