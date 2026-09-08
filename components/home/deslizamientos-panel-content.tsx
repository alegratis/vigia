"use client"

import { useEffect, useState } from "react"
import { DeslizamientosLiveMapLoader } from "@/components/maps/deslizamientos-live-map-loader"
import { LiveThreatPopulation } from "@/components/deslizamientos/live-threat-population"
import type { OsmCategoryKey } from "@/lib/osm/categories"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import type { MapBounds } from "@/lib/map-bounds"

interface DeslizamientosPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** OSM infrastructure points, filtered to the categories toggled on in the sidebar. */
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded deslizamientos panel for the homepage workspace. The map fills
 * the full first fold so it always takes all the space available; the
 * susceptibility layer's own population/infrastructure breakdown by threat
 * level (not municipio, so it can't feed the shared sidebar card) scrolls
 * in below it.
 */
export function DeslizamientosPanelContent({ onBoundsChange, activeOsmPoints }: DeslizamientosPanelContentProps) {
  const [selectedLevel, setSelectedLevel] = useState<SusceptibilityLevel | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div role="region" aria-label="Mapa de susceptibilidad a deslizamiento" className="h-[70vh] min-h-[420px] shrink-0 lg:h-full">
        <p className="sr-only">
          Mapa interactivo de susceptibilidad a deslizamiento. El panel de
          población por nivel de amenaza, debajo, resume el mismo contenido
          en formato de texto.
        </p>
        <DeslizamientosLiveMapLoader
          className="relative h-full w-full"
          onBoundsChange={onBoundsChange}
          onPointSelect={setSelectedLevel}
          osmPoints={activeOsmPoints}
        />
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div aria-live="polite">
          <LiveThreatPopulation
            selectedLevel={selectedLevel}
            onClearSelection={() => setSelectedLevel(null)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Índice de susceptibilidad <code className="text-foreground">VIGIA_Amenaza_IS</code> (RED
          LabOT), publicado en ArcGIS Online. Haz clic sobre cualquier punto para ver su municipio y
          nivel de susceptibilidad. Activa la capa de humedad del suelo (NASA SMAP) para ver la señal
          de disparo antecedente.
        </p>
      </div>
    </div>
  )
}
