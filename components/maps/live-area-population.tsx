"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { MapPin, Users } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { DemografiaFilters } from "@/components/demografia/demografia-filters"
import { REFERENCE_POINTS } from "@/lib/firms/area"
import { pointsInBounds, type MapBounds } from "@/lib/map-bounds"
import { formatNumber, formatShare } from "@/lib/demografia/ui"
import {
  AVAILABLE_YEARS,
  DEMOGRAFIA_CATEGORIES,
  getCategoryValue,
  type AvailableYear,
  type DemografiaCategoryKey,
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
  className?: string
}

const LATEST_YEAR = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]

/**
 * Cross-references the current qgis2web map viewport (received via
 * postMessage from QgisMapCanvas) against the municipality reference points,
 * and shows DANE population for whichever municipalities are in frame. Comes
 * with the same "Panel de consulta" year/category filters as the overview
 * page, preselected to the category most relevant for this hazard.
 */
export function LiveAreaPopulation({
  bounds,
  basis,
  basisLabel,
  className,
}: LiveAreaPopulationProps) {
  const { data, isLoading } = useSWR<DemografiaResponse>("/api/demografia", fetcher, {
    revalidateOnFocus: false,
  })

  const [year, setYear] = useState<AvailableYear>(LATEST_YEAR)
  const [selectedCategories, setSelectedCategories] = useState<DemografiaCategoryKey[]>(
    [basis],
  )

  const activeCategories = useMemo(
    () => DEMOGRAFIA_CATEGORIES.filter((c) => selectedCategories.includes(c.key)),
    [selectedCategories],
  )

  if (isLoading || !data) {
    return <Skeleton className={`h-64 rounded-xl ${className ?? ""}`} />
  }

  const inView = bounds ? pointsInBounds(REFERENCE_POINTS, bounds) : null
  const namesInView: string[] | null =
    inView && inView.length > 0 ? inView.map((p) => p.name) : null
  const visible = namesInView
    ? data.municipios.filter((m) => namesInView.includes(m.municipio))
    : data.municipios

  const totalPoblacion = visible.reduce(
    (sum, m) => sum + (m.population.years[year]?.total ?? 0),
    0,
  )

  return (
    <Card className={className}>
      <CardHeader className="gap-1 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
          <Users className="size-4" aria-hidden="true" />
          Población en el encuadre actual
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {namesInView
            ? `Municipios visibles: ${namesInView.join(", ")}.`
            : bounds
              ? "Ningún centroide municipal cae dentro del encuadre actual; se muestran los tres municipios de referencia."
              : "Mueve el mapa publicado para filtrar por el área visible. Por ahora se muestran los tres municipios de referencia."}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        <DemografiaFilters
          year={year}
          onYearChange={setYear}
          selectedCategories={selectedCategories}
          onSelectedCategoriesChange={setSelectedCategories}
        />

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Población total</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatNumber(totalPoblacion)}
            </span>
          </div>
          {activeCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Selecciona al menos una categoría en el panel de consulta.
            </p>
          ) : (
            activeCategories.map((category) => {
              const value = visible.reduce(
                (sum, m) => sum + getCategoryValue(m.population, category.key, year),
                0,
              )
              return (
                <div key={category.key} className="flex items-baseline justify-between">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span
                      className={`size-2.5 rounded-full ${category.swatchClass}`}
                      aria-hidden="true"
                    />
                    {category.key === basis ? basisLabel : category.label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatNumber(value)} ({formatShare(value, totalPoblacion)})
                  </span>
                </div>
              )
            })
          )}
        </div>

        {activeCategories.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
            {visible.map((m) => (
              <li key={m.municipio} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-foreground">
                  <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {m.municipio}
                </span>
                <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                  {activeCategories.map((category) => (
                    <span key={category.key}>
                      {formatNumber(getCategoryValue(m.population, category.key, year))}{" "}
                      {category.label.slice(0, 3).toLowerCase()}.
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
