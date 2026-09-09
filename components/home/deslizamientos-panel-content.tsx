"use client"

import { useRef } from "react"
import { DeslizamientosLiveMapLoader } from "@/components/maps/deslizamientos-live-map-loader"
import { LiveThreatPopulation } from "@/components/deslizamientos/live-threat-population"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

interface DeslizamientosPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** OSM infrastructure points, filtered to the categories toggled on in the sidebar. */
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded deslizamientos panel for the homepage workspace. The map fills
 * the full first fold so it always takes all the space available; a
 * population/infrastructure breakdown by threat level scrolls in below it
 * — sourced independently from RED LabOT's original susceptibility grid
 * (see LiveThreatPopulation), decoupled from the map's own hazard model
 * above (see lib/deslizamientos/hazard-model.ts) since the two use
 * different level classifications and there's no shared per-point
 * selection between them anymore.
 */
export function DeslizamientosPanelContent({ onBoundsChange, activeOsmPoints }: DeslizamientosPanelContentProps) {
  const statsRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de amenaza por deslizamiento"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de amenaza por deslizamiento, por vereda. El panel
          de población por nivel de amenaza, debajo, resume un índice
          relacionado en formato de texto.
        </p>
        <DeslizamientosLiveMapLoader
          className="relative h-full w-full"
          onBoundsChange={onBoundsChange}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={statsRef} label="Ver población por amenaza" />
      </div>
      <div ref={statsRef} className="flex flex-col gap-4 p-4 sm:p-6">
        <div aria-live="polite">
          <LiveThreatPopulation />
        </div>
        <p className="text-xs text-muted-foreground">
          El mapa colorea cada vereda con un modelo propio de amenaza —
          pendiente del terreno (DEM Copernicus), cercanía a vías (OSM) y
          anomalía de lluvia reciente frente a su histórico (Open-Meteo) —
          en lugar del índice <code className="text-foreground">VIGIA_Amenaza_IS</code> de RED
          LabOT, que solo cubría Sevilla y Caicedonia. El panel de población
          debajo sigue leyendo ese índice de RED LabOT directamente, con su
          propia clasificación. Activa la capa de humedad del suelo (NASA
          SMAP) para contrastar la señal de disparo, o la capa de sitios
          críticos para ver puntos de daño vial verificados en campo
          (hundimientos, derrumbes, erosión, grietas de tracción) del
          levantamiento de 2019 de la Secretaría de Infraestructura del
          Valle del Cauca — un complemento puntual e histórico, no una capa
          en vivo.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
