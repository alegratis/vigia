"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { AlertTriangle, Droplets, Flame, Mountain, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LevelBadge } from "@/components/flood/level-badge"
import { DemografiaFilters } from "@/components/demografia/demografia-filters"
import { formatNumber, formatShare } from "@/lib/demografia/ui"
import {
  AVAILABLE_YEARS,
  DEMOGRAFIA_CATEGORIES,
  getCategoryValue,
  type AvailableYear,
  type DemografiaCategoryKey,
} from "@/lib/demografia/categories"
import type {
  DemografiaResponse,
  DemografiaErrorResponse,
  MunicipioExposureView,
} from "@/lib/demografia/api-types"

class DemografiaError extends Error {}

const fetcher = async (url: string): Promise<DemografiaResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    let payload: DemografiaErrorResponse | null = null
    try {
      payload = (await res.json()) as DemografiaErrorResponse
    } catch {
      // ignore parse failure
    }
    throw new DemografiaError(
      payload?.error ?? "No se pudo cargar el panel demográfico",
    )
  }
  return res.json()
}

const chartConfig: ChartConfig = {
  urbano: { label: "Urbano", color: "var(--demografia-urbano)" },
  rural: { label: "Rural", color: "var(--demografia-rural)" },
  hombres: { label: "Hombres", color: "var(--demografia-hombres)" },
  mujeres: { label: "Mujeres", color: "var(--demografia-mujeres)" },
}

const DEFAULT_CATEGORIES: DemografiaCategoryKey[] = ["urbano", "rural"]
const LATEST_YEAR = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]

export function DemografiaOverview() {
  const { data, error, isLoading, mutate } = useSWR<DemografiaResponse, DemografiaError>(
    "/api/demografia",
    fetcher,
    { revalidateOnFocus: false },
  )

  const [year, setYear] = useState<AvailableYear>(LATEST_YEAR)
  const [selectedCategories, setSelectedCategories] =
    useState<DemografiaCategoryKey[]>(DEFAULT_CATEGORIES)

  const activeCategories = useMemo(
    () => DEMOGRAFIA_CATEGORIES.filter((c) => selectedCategories.includes(c.key)),
    [selectedCategories],
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 md:flex-row">
        <Skeleton className="h-96 w-full rounded-xl md:w-64" />
        <div className="flex flex-1 flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
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
            {error?.message ?? "El servicio de datos podría no estar disponible."}
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

  const { municipios } = data
  const totalPoblacion = municipios.reduce(
    (s, m) => s + (m.population.years[year]?.total ?? 0),
    0,
  )

  const chartData = municipios.map((m) => {
    const row: Record<string, number | string> = { municipio: m.municipio }
    for (const category of activeCategories) {
      row[category.key] = getCategoryValue(m.population, category.key, year)
    }
    return row
  })

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <Card className="h-fit w-full shrink-0 md:w-64">
        <CardHeader className="border-b border-border">
          <h2 className="text-sm font-semibold tracking-tight">Panel de consulta</h2>
        </CardHeader>
        <CardContent className="pt-4">
          <DemografiaFilters
            year={year}
            onYearChange={setYear}
            selectedCategories={selectedCategories}
            onSelectedCategoriesChange={setSelectedCategories}
          />
        </CardContent>
      </Card>

      <div className="flex flex-1 flex-col gap-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {activeCategories.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">
              Selecciona al menos una categoría en el panel de consulta.
            </p>
          ) : (
            activeCategories.map((category) => {
              const value = municipios.reduce(
                (s, m) => s + getCategoryValue(m.population, category.key, year),
                0,
              )
              return (
                <MetricCard
                  key={category.key}
                  label={category.label}
                  value={`${formatNumber(value)} (${formatShare(value, totalPoblacion)})`}
                  swatchClass={category.swatchClass}
                />
              )
            })
          )}
        </div>

        <Card>
          <CardHeader className="border-b border-border">
            <h2 className="font-semibold tracking-tight">
              Distribución por municipio · {year}
            </h2>
            <p className="text-sm text-muted-foreground">
              Proyección DANE {year} · población rural es la más expuesta a
              deslizamientos e incendios forestales; la urbana concentra el
              riesgo de inundación en cascos urbanos.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {activeCategories.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Selecciona al menos una categoría para ver el gráfico.
              </p>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart
                  data={chartData}
                  barGap={8}
                  accessibilityLayer
                  role="img"
                  aria-label={`Distribución de población por municipio, año ${year}`}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="municipio"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v: number) => formatNumber(v)}
                    width={56}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {activeCategories.map((category) => (
                    <Bar
                      key={category.key}
                      dataKey={category.key}
                      fill={`var(--color-${category.key})`}
                      radius={4}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {municipios.map((m) => (
            <MunicipioCard
              key={m.municipio}
              municipio={m}
              year={year}
              fireNeedsConfig={data.fireNeedsConfig}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Fuente: DANE, &ldquo;Distribución Poblacional del Valle del Cauca&rdquo;
          (datos.gov.co, recurso 4wbc-urmu), proyecciones 2018-2020. La
          exposición por amenaza cruza esta población de referencia con la
          señal de monitoreo en vivo de cada módulo (GEOGLOWS e NASA FIRMS); no
          sustituye un censo puerta a puerta ni un modelo de extensión de
          inundación o susceptibilidad a deslizamientos.
        </p>
      </div>
    </div>
  )
}

function MunicipioCard({
  municipio,
  year,
  fireNeedsConfig,
}: {
  municipio: MunicipioExposureView
  year: AvailableYear
  fireNeedsConfig: boolean
}) {
  const { population, flood, fire } = municipio
  const yearData = population.years[year]

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <h3 className="font-semibold tracking-tight">{municipio.municipio}</h3>
        <p className="text-sm text-muted-foreground">
          {formatNumber(yearData.total)} habitantes · {formatNumber(yearData.urbano)}{" "}
          urbanos · {formatNumber(yearData.rural)} rurales
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        <HazardRow
          icon={<Droplets className="size-4" aria-hidden="true" />}
          label="Inundaciones"
          reference={`${formatNumber(yearData.total)} hab. en el municipio`}
        >
          {flood ? (
            <LevelBadge level={flood.worstLevel} />
          ) : (
            <span className="text-xs text-muted-foreground">Sin datos</span>
          )}
        </HazardRow>

        <HazardRow
          icon={<Flame className="size-4" aria-hidden="true" />}
          label="Incendios"
          reference={`${formatNumber(yearData.rural)} hab. en zona rural`}
        >
          {fireNeedsConfig ? (
            <span className="text-xs text-muted-foreground">Requiere clave</span>
          ) : fire ? (
            <span
              className={
                fire.count > 0
                  ? "text-xs font-medium text-[var(--chart-5)]"
                  : "text-xs text-muted-foreground"
              }
            >
              {fire.count} foco{fire.count === 1 ? "" : "s"} activo
              {fire.count === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Sin datos</span>
          )}
        </HazardRow>

        <HazardRow
          icon={<Mountain className="size-4" aria-hidden="true" />}
          label="Deslizamientos"
          reference={`${formatNumber(yearData.rural)} hab. en zona rural`}
        >
          <span className="text-xs text-muted-foreground">Próximamente</span>
        </HazardRow>
      </CardContent>
    </Card>
  )
}

function HazardRow({
  icon,
  label,
  reference,
  children,
}: {
  icon: React.ReactNode
  label: string
  reference: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{reference}</p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  swatchClass,
}: {
  label: string
  value: string
  swatchClass: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`size-2.5 rounded-full ${swatchClass}`} aria-hidden="true" />
          {label}
        </span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  )
}
