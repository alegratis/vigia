"use client"

import { useMemo } from "react"
import { useSismologiaEventos } from "@/lib/sismologia/use-sismologia"
import { formatQuakeAge, getLatestSeismicEvents } from "@/lib/sismologia/latest-events"
import { MIN_NUMBERED_MAGNITUDE, SEISMIC_MAGNITUDE_LEVEL_STYLES, magnitudeLevel } from "@/lib/sismologia/levels"
import { formatDateTime } from "@/lib/firms/ui"
import type { SeismicEvent } from "@/lib/sismologia/api-types"
import { tokenColor } from "@/lib/utils"

const QUAKE_COUNT = 15

interface LatestQuakesListProps {
  selectedId: string | null
  onSelect: (quake: SeismicEvent | null) => void
}

export function LatestQuakesList({ selectedId, onSelect }: LatestQuakesListProps) {
  const { data, error, isLoading } = useSismologiaEventos()
  const quakes = useMemo(() => getLatestSeismicEvents(data, QUAKE_COUNT), [data])

  return (
    <section aria-label={`Últimos ${QUAKE_COUNT} sismos`} className="flex flex-col gap-2 border-t border-border/70 p-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">Últimos {QUAKE_COUNT} sismos</h3>
        <p className="text-[11px] text-muted-foreground">
          Magnitud ≥ {MIN_NUMBERED_MAGNITUDE}. Toca uno para verlo resaltado en el mapa.
        </p>
      </div>

      {isLoading && quakes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Cargando eventos recientes…</p>
      ) : error && quakes.length === 0 ? (
        <p className="text-xs text-destructive">No se pudieron cargar los sismos.</p>
      ) : quakes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin sismos recientes en el área.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {quakes.map((quake) => {
            const magnitude = Number(quake.magnitude)
            const style = SEISMIC_MAGNITUDE_LEVEL_STYLES[magnitudeLevel(magnitude)]
            const selected = quake.id === selectedId
            return (
              <li key={quake.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : quake)}
                  className={`flex w-full items-center gap-2.5 rounded-md border p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                    selected ? "border-primary bg-accent" : "border-transparent hover:bg-accent/60"
                  }`}
                >
                  <span
                    className="flex h-8 w-11 shrink-0 flex-col items-center justify-center rounded-md font-mono text-xs font-bold leading-none text-white"
                    style={{ backgroundColor: tokenColor(style.colorToken) }}
                    aria-hidden="true"
                  >
                    {magnitude.toFixed(1)}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-medium leading-tight text-foreground">
                      <span className="sr-only">Magnitud {magnitude.toFixed(1)}, {style.label}. </span>
                      {formatDateTime(quake.time)}
                    </span>
                    <span className="truncate text-[11px] leading-tight text-muted-foreground">
                      {formatQuakeAge(quake.time)} · {style.label}
                      {quake.place ? ` · ${quake.place}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
