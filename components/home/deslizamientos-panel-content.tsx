"use client"

import { useEffect, useRef, useState } from "react"
import { DeslizamientosLiveMapLoader } from "@/components/maps/deslizamientos-live-map-loader"
import { LiveThreatPopulation } from "@/components/deslizamientos/live-threat-population"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
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
  const statsRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de susceptibilidad a deslizamiento"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
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
        <ScrollHintButton targetRef={statsRef} label="Ver población por amenaza" />
      </div>
      <div ref={statsRef} className="flex flex-col gap-4 p-4 sm:p-6">
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
          de disparo antecedente, o la capa de sitios críticos para ver puntos de daño vial
          verificados en campo (hundimientos, derrumbes, erosión, grietas de tracción) del
          levantamiento de 2019 de la Secretaría de Infraestructura del Valle del Cauca — un
          complemento puntual e histórico al índice modelado, no una capa en vivo.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
