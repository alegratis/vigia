"use client"

import { useRef } from "react"
import { IncendiosLiveMapLoader } from "@/components/maps/incendios-live-map-loader"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { FireOverview } from "@/components/fires/fire-overview"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

interface IncendiosPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** Bubbles a clicked zone's municipio up to the shared sidebar card. */
  onZoneSelect?: (municipio: string) => void
  /** OSM infrastructure points, filtered to the categories toggled on in the sidebar. */
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded incendios panel for the homepage workspace: the fire-threat map
 * fills the full first fold; its source caption scrolls in below.
 * Demographics and infrastructure toggles live in the workspace's shared
 * sidebar, fed by onBoundsChange/onZoneSelect.
 */
export function IncendiosPanelContent({
  onBoundsChange,
  onZoneSelect,
  activeOsmPoints,
}: IncendiosPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        role="region"
        aria-label="Mapa de amenaza por incendios forestales"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de amenaza por incendios forestales, con pronóstico del
          Índice Meteorológico de Incendio. El panel de población en el encuadre
          actual, en la barra lateral, resume el mismo contenido en formato de texto.
        </p>
        <IncendiosLiveMapLoader
          className="relative h-full w-full"
          onBoundsChange={onBoundsChange}
          onZoneSelect={onZoneSelect}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={captionRef} label="Ver focos activos NASA FIRMS" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div aria-live="polite">
          <FireOverview />
        </div>
        <p className="text-xs text-muted-foreground">
          Amenaza por vereda: capa pública <code className="text-foreground">AmenazaIncendios</code>,
          publicada en ArcGIS Online. Pronóstico FWI: servicio abierto{" "}
          <a
            href="https://gwis.jrc.ec.europa.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            GWIS / Copernicus EFFIS
          </a>{" "}
          (Centro Común de Investigación de la UE). Haz clic sobre cualquier zona para ver
          su municipio, vereda y nivel de amenaza.
        </p>
      </div>
    </div>
  )
}
