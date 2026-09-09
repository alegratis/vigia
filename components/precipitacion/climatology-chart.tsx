"use client"

import useSWR from "swr"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { AlertTriangle, CloudRain, MapPin, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { ClimatologiaResponse } from "@/lib/precipitacion/api-types"

export interface SelectedVereda {
  codigoVereda: string
  nombre: string
  municipio: string
}

interface ClimatologyChartProps {
  vereda: SelectedVereda | null
}

const fetcher = async (url: string): Promise<ClimatologiaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la climatología de la vereda")
  return res.json()
}

const CHART_CONFIG = {
  mm1991_2020: { label: "Normal 1991-2020", color: "var(--chart-1)" },
  mm1981_2010: { label: "Normal 1981-2010", color: "var(--chart-2)" },
} as const

/**
 * Monthly rainfall "normal" histogram for whichever vereda was last
 * clicked on the precipitación map — mirrors the classic IDEAM station
 * histogram (bars for two published normal periods, mm labeled on top),
 * but built from IDEAM's public interpolated climatology raster (see
 * lib/precipitacion/ideam-climatology.ts) rather than one station's exact
 * readings, since that's the only version of this data open for every
 * vereda instead of just the two municipios with a nearby station. Each
 * bar is a band midpoint, disclosed both in the tooltip and the caption
 * below so it doesn't read as more precise than it is.
 */
export function ClimatologyChart({ vereda }: ClimatologyChartProps) {
  const { data, error, isLoading, mutate, isValidating } = useSWR<ClimatologiaResponse>(
    vereda ? `/api/precipitacion/climatologia?codigoVereda=${encodeURIComponent(vereda.codigoVereda)}` : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  if (!vereda) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CloudRain className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Histograma de lluvia normal por vereda</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Haz clic sobre cualquier vereda en el mapa para ver su histograma mensual de precipitación normal.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-80 rounded-xl" />
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
            <p className="font-medium">No se pudo cargar el histograma</p>
          </div>
          <p className="text-sm text-muted-foreground">
            El servicio de climatología de IDEAM (visualizador.ideam.gov.co) podría no estar disponible en este
            momento.
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

  const chartData = data.meses.map((m) => ({
    monthLabel: m.monthLabel,
    mm1991_2020: m.mm1991_2020,
    rango1991_2020: m.rango1991_2020,
    mm1981_2010: m.mm1981_2010,
    rango1981_2010: m.rango1981_2010,
  }))
  const hasAnyData = chartData.some((m) => m.mm1991_2020 != null || m.mm1981_2010 != null)

  return (
    <Card>
      <CardHeader className="gap-1 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="font-semibold tracking-tight">
              Histograma de lluvia normal — {data.vereda.nombre} ({data.vereda.municipio})
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
        <p className="text-xs text-muted-foreground">
          IDEAM — normales climatológicas mensuales interpoladas, periodos 1991-2020 y 1981-2010
        </p>
      </CardHeader>
      <CardContent className="pt-4">
        {hasAnyData ? (
          <ChartContainer config={CHART_CONFIG} className="h-[320px] w-full">
            <BarChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
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
                      const rangoKey = name === "mm1991_2020" ? "rango1991_2020" : "rango1981_2010"
                      const rango = (item?.payload as Record<string, string | null>)?.[rangoKey]
                      return rango ? `${rango} (aprox. ${value} mm)` : `${value} mm`
                    }}
                  />
                }
              />
              <Bar dataKey="mm1991_2020" fill="var(--color-mm1991_2020)" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="mm1991_2020" position="top" className="fill-foreground text-[10px]" />
              </Bar>
              <Bar dataKey="mm1981_2010" fill="var(--color-mm1981_2010)" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="mm1981_2010" position="top" className="fill-foreground text-[10px]" />
              </Bar>
            </BarChart>
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
          </a>{" "}
          en el centroide de la vereda (ver el rango original en cada barra al pasar el cursor), no la lectura
          exacta de una estación individual — a diferencia del histograma de una sola estación (por ejemplo,
          Cumbarco en Sevilla), esta versión cubre cualquier vereda del área de estudio.
        </p>
      </CardContent>
    </Card>
  )
}
