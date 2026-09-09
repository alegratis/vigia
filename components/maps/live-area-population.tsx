"use client"

import { useState } from "react"
import useSWR from "swr"
import { MapPin, Users } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { REFERENCE_POINTS } from "@/lib/firms/area"
import { pointsInBounds, type MapBounds } from "@/lib/map-bounds"
import { formatNumber, formatShare } from "@/lib/demografia/ui"
import {
  AVAILABLE_YEARS,
  DEMOGRAFIA_CATEGORY_GROUPS,
  categoriesInGroup,
  getCategoryValue,
  type AvailableYear,
} from "@/lib/demografia/categories"
import type { DemografiaResponse } from "@/lib/demografia/api-types"

const fetcher = async (url: string): Promise<DemografiaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la demografía")
  return res.json()
}

interface LiveAreaPopulationProps {
  bounds: MapBounds | null
  /** Which population category to preselect for this hazard's map card. */
  basis: "urbano" | "rural"
  basisLabel: string
  /** Set when a zone was just clicked on the map — narrows the panel to that municipio. */
  selectedMunicipio?: string | null
  onClearSelection?: () => void
  className?: string
}

const LATEST_YEAR = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]

/**
 * Cross-references the current qgis2web map viewport (received via
 * postMessage from QgisMapCanvas) against the municipality reference points,
 * and shows DANE population for whichever municipalities are in frame.
 * Every category (urbano, rural, hombres, mujeres) and the total are shown
 * at once — no checkboxes to reveal them — since this is glanceable
 * reference data, not a filter the user is choosing between. The only
 * control left is the year, which genuinely changes which figures are
 * being shown rather than just hiding/revealing already-computed ones.
 */
export function LiveAreaPopulation({
  bounds,
  basis,
  basisLabel,
  selectedMunicipio,
  onClearSelection,
  className,
}: LiveAreaPopulationProps) {
  const { data, isLoading } = useSWR<DemografiaResponse>("/api/demografia", fetcher, {
    revalidateOnFocus: false,
  })

  const [year, setYear] = useState<AvailableYear>(LATEST_YEAR)

  if (isLoading || !data) {
    return <Skeleton className={cn("h-[420px] max-h-[60vh] rounded-xl", className)} />
  }

  const inView = bounds ? pointsInBounds(REFERENCE_POINTS, bounds) : null
  const namesInView: string[] | null = selectedMunicipio
    ? [selectedMunicipio]
    : inView && inView.length > 0
      ? inView.map((p) => p.name)
      : null
  const visible = namesInView
    ? data.municipios.filter((m) => namesInView.includes(m.municipio))
    : data.municipios

  const totalPoblacion = visible.reduce(
    (sum, m) => sum + (m.population.years[year]?.total ?? 0),
    0,
  )

  return (
    <Card className={cn("flex h-[420px] max-h-[60vh] flex-col", className)}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Users className="size-4" aria-hidden="true" />
          {selectedMunicipio ? `Selección: ${selectedMunicipio}` : "Población en el encuadre actual"}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {selectedMunicipio
            ? "Zona seleccionada en el mapa. Haz clic en \u201cVer todo\u201d para volver al encuadre."
            : namesInView
              ? `Municipios visibles: ${namesInView.join(", ")}.`
              : bounds
                ? "Ningún centroide municipal cae dentro del encuadre actual; se muestran los tres municipios de referencia."
                : "Mueve el mapa publicado para filtrar por el área visible. Por ahora se muestran los tres municipios de referencia."}
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        {selectedMunicipio && (
          <div className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-xs">
            <span className="text-foreground">
              Selección: <span className="font-medium">{selectedMunicipio}</span>
            </span>
            <button
              type="button"
              onClick={() => onClearSelection?.()}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Ver todo
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Año
          </span>
          <ToggleGroup
            value={[String(year)]}
            onValueChange={(value) => {
              const next = value[0]
              if (next) setYear(Number(next) as AvailableYear)
            }}
            variant="outline"
            className="flex-wrap justify-end"
          >
            {AVAILABLE_YEARS.map((y) => (
              <ToggleGroupItem key={y} value={String(y)} aria-label={`Año ${y}`}>
                {y}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Población total</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatNumber(totalPoblacion)}
            </span>
          </div>

          {DEMOGRAFIA_CATEGORY_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              {categoriesInGroup(group.key).map((category) => {
                const value = visible.reduce(
                  (sum, m) => sum + getCategoryValue(m.population, category.key, year),
                  0,
                )
                const isBasis = category.key === basis
                return (
                  <div key={category.key} className="flex items-baseline justify-between">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-sm",
                        isBasis ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={`size-2.5 rounded-full ${category.swatchClass}`}
                        aria-hidden="true"
                      />
                      {isBasis ? basisLabel : category.label}
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        isBasis ? "font-semibold text-foreground" : "font-medium text-foreground",
                      )}
                    >
                      {formatNumber(value)} ({formatShare(value, totalPoblacion)})
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border pt-3">
          {visible.map((m) => {
            const total = m.population.years[year]?.total ?? 0
            return (
              <div key={m.municipio} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {m.municipio}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatNumber(total)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMOGRAFIA_CATEGORY_GROUPS.flatMap((group) => categoriesInGroup(group.key)).map(
                    (category) => {
                      const value = getCategoryValue(m.population, category.key, year)
                      return (
                        <div
                          key={category.key}
                          className="flex flex-col gap-0.5 rounded-md bg-background px-2 py-1.5"
                        >
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className={`size-2 shrink-0 rounded-full ${category.swatchClass}`}
                              aria-hidden="true"
                            />
                            {category.label}
                          </span>
                          <span className="text-sm font-medium tabular-nums text-foreground">
                            {formatNumber(value)}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              ({formatShare(value, total)})
                            </span>
                          </span>
                        </div>
                      )
                    },
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
