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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
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
 * Monthly rainfall chart below the precipitación map: two bars for IDEAM's
 * published normal periods (see lib/precipitacion/ideam-climatology.ts),
 * plus an optional line for this calendar year's actual accumulation
 * (NASA POWER — see power-client.ts's getCurrentYearMonthlyPrecipitation),
 * so a viewer can see whether the current year is running above or below
 * normal for a given month.
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
  // Vereda selection takes over the chart the moment one is clicked; remember whether that's currently
  // in effect so a later municipio-tab click can explicitly hand control back.
  const [mode, setMode] = useState<"vereda" | "municipio">("municipio")

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

  const chartData = useMemo(
    () =>
      (data?.meses ?? []).map((m) => ({
        monthLabel: m.monthLabel,
        mm1991_2020: m.mm1991_2020,
        rango1991_2020: m.rango1991_2020,
        mm1981_2010: m.mm1981_2010,
        rango1981_2010: m.rango1981_2010,
        mmActual: m.mmActual,
        esMesEnCurso: m.esMesEnCurso,
      })),
    [data],
  )
  const hasAnyData = chartData.some((m) => m.mm1991_2020 != null || m.mm1981_2010 != null)
  const currentYear = new Date().getFullYear()

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
          <div className="flex items-center gap-2">
            <Switch id="show-actual-year" checked={showActual} onCheckedChange={setShowActual} />
            <Label htmlFor="show-actual-year" className="text-sm font-medium text-foreground">
              Mostrar {currentYear} (año en curso)
            </Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "vereda" && vereda
            ? "IDEAM — normales mensuales interpoladas en el centroide de la vereda seleccionada."
            : `IDEAM — normales mensuales promediadas entre las ${data?.ubicacion.veredasPromediadas ?? ""} veredas rurales de ${municipio}.`}
          {showActual && " Línea: acumulado real de este año (NASA POWER)."}
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
              El servicio de climatología de IDEAM (visualizador.ideam.gov.co) o NASA POWER podría no estar
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
          <ChartContainer config={CHART_CONFIG} className="h-[320px] w-full">
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
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      if (name === "mmActual") {
                        const partial = (item?.payload as Record<string, boolean>)?.esMesEnCurso
                        return `${value} mm${partial ? " (mes en curso, parcial)" : ""}`
                      }
                      const rangoKey = name === "mm1991_2020" ? "rango1991_2020" : "rango1981_2010"
                      const rango = (item?.payload as Record<string, string | null>)?.[rangoKey]
                      return rango ? `${rango} (aprox. ${value} mm)` : `${value} mm`
                    }}
                  />
                }
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
            href="https://power.larc.nasa.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            NASA POWER
          </a>{" "}
          para cada mes transcurrido; el mes en curso es un acumulado parcial (no cierra hasta fin de mes), y los
          meses futuros del año no se dibujan.
        </p>
      </CardContent>
    </Card>
  )
}
