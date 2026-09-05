"use client"

import useSWR from "swr"
import { MapPin, Users } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { REFERENCE_POINTS } from "@/lib/firms/area"
import { pointsInBounds, type MapBounds } from "@/lib/map-bounds"
import { formatNumber, formatShare } from "@/lib/demografia/ui"
import type { DemografiaResponse } from "@/lib/demografia/api-types"

const fetcher = async (url: string): Promise<DemografiaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la demografía")
  return res.json()
}

interface LiveAreaPopulationProps {
  bounds: MapBounds | null
  /** Which population figure to foreground for this hazard. */
  basis: "urbano" | "rural"
  basisLabel: string
  className?: string
}

/**
 * Cross-references the current qgis2web map viewport (received via
 * postMessage from QgisMapCanvas) against the municipality reference points,
 * and shows DANE population for whichever municipalities are in frame.
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

  if (isLoading || !data) {
    return <Skeleton className={`h-64 rounded-xl ${className ?? ""}`} />
  }

  const inView = bounds ? pointsInBounds(REFERENCE_POINTS, bounds) : null
  const namesInView: string[] | null =
    inView && inView.length > 0 ? inView.map((p) => p.name) : null
  const visible = namesInView
    ? data.municipios.filter((m) => namesInView.includes(m.municipio))
    : data.municipios

  const totalBasis = visible.reduce((sum, m) => sum + m.population[basis], 0)
  const totalPoblacion = visible.reduce((sum, m) => sum + m.population.total, 0)

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
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Población total</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatNumber(totalPoblacion)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">{basisLabel}</span>
            <span className="font-medium tabular-nums">
              {formatNumber(totalBasis)} ({formatShare(totalBasis, totalPoblacion)})
            </span>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
          {visible.map((m) => (
            <li key={m.municipio} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-foreground">
                <MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {m.municipio}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(m.population[basis])} {basis === "urbano" ? "urb." : "rur."}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
