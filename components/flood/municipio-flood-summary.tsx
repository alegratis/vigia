"use client"

import { useState } from "react"
import useSWR from "swr"
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LevelBadge } from "@/components/flood/level-badge"
import { Hydrograph } from "@/components/flood/hydrograph"
import { StationDetailDialog } from "@/components/flood/station-detail-dialog"
import { formatFlow, formatLeadTime, levelStyle } from "@/lib/flood-ui"
import { getMunicipioStationGroups, type Station } from "@/lib/geoglows/stations"
import type { ReachAssessmentResponse } from "@/lib/geoglows/api-types"

const fetcher = async (url: string): Promise<ReachAssessmentResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar el pronóstico")
  return res.json()
}

const MUNICIPIO_GROUPS = getMunicipioStationGroups()

/**
 * Permanent, always-visible flood snapshot for each of the three
 * municipios — no click required. Each card combines the municipio's
 * current risk level (its "potential for flooding" right now, from
 * GEOGLOWS) with a compact 15-day forecast hydrograph for its main
 * channel station, so a viewer sees both at a glance. Clicking a card, or
 * one of its secondary tributary stations, opens the same in-place detail
 * dialog used by the map and the station overview grid.
 */
export function MunicipioFloodSummary() {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Potencial de inundación por municipio</h2>
        <p className="text-sm text-muted-foreground">
          Nivel de riesgo actual y pronóstico de caudal a 15 días para la estación principal de
          cada municipio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MUNICIPIO_GROUPS.map(({ municipio, stations }) => (
          <MunicipioFloodCard
            key={municipio}
            municipio={municipio}
            stations={stations}
            onSelectStation={setSelectedStation}
          />
        ))}
      </div>

      <StationDetailDialog
        station={selectedStation}
        onOpenChange={(open) => {
          if (!open) setSelectedStation(null)
        }}
      />
    </div>
  )
}

function MunicipioFloodCard({
  municipio,
  stations,
  onSelectStation,
}: {
  municipio: string
  stations: Station[]
  onSelectStation: (station: Station) => void
}) {
  const primary = stations[0]
  const secondary = stations.slice(1)
  const { data, error, isLoading, mutate, isValidating } = useSWR<ReachAssessmentResponse>(
    `/api/reaches/${primary.reachId}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  return (
    <Card className="overflow-hidden">
      {data && (
        <span
          className="block h-1 w-full"
          style={{ backgroundColor: levelStyle(data.current.level.key).color }}
          aria-hidden="true"
        />
      )}
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold tracking-tight">{municipio}</h3>
          {data && <LevelBadge level={data.current.level.key} />}
        </div>
        <p className="text-xs text-muted-foreground">{primary.river}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading && <Skeleton className="h-24 w-full rounded-lg" />}

        {error && (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 p-3">
            <p className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              No se pudo cargar el pronóstico
            </p>
            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={isValidating ? "size-3 animate-spin" : "size-3"} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        )}

        {data && (
          <>
            <button
              type="button"
              onClick={() => onSelectStation(primary)}
              className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Ver hidrograma completo de ${primary.name}`}
            >
              <Hydrograph series={data.series} thresholds={data.thresholds} className="h-24 w-full" compact />
            </button>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Caudal actual</span>
              <span className="font-medium tabular-nums">{formatFlow(data.current.flow)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="size-3.5" aria-hidden="true" />
                Pico previsto (15 días)
              </span>
              <span className="tabular-nums">{formatFlow(data.peak.flow)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cruce de vigilancia</span>
              <span className="tabular-nums">
                {data.medianExceedance ? formatLeadTime(data.medianExceedance.leadTimeHours) : "Sin cruce"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSelectStation(primary)}
              className="text-left text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Ver pronóstico completo →
            </button>

            {secondary.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Otras estaciones</p>
                {secondary.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => onSelectStation(s)}
                    className="text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
