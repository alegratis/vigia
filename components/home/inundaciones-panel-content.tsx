"use client"

import { useRef } from "react"
import { GeoglowsLiveMapLoader } from "@/components/maps/geoglows-live-map-loader"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import { FloodOverview } from "@/components/flood/flood-overview"
import { MunicipioFloodSummary } from "@/components/flood/municipio-flood-summary"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

interface InundacionesPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** Bubbles a clicked river reach/zone's municipio up to the shared sidebar card. */
  onZoneSelect?: (municipio: string) => void
  /** OSM infrastructure points, filtered to the categories toggled on in the sidebar. */
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded inundaciones panel for the homepage workspace: GEOGLOWS' live
 * flood forecast map fills the full first fold. Below it, a permanent
 * per-municipio flood summary (MunicipioFloodSummary) and the full station
 * overview grid (FloodOverview) scroll in — both open a station's full
 * forecast in an in-place dialog rather than navigating to a separate page.
 * Demographics and infrastructure toggles live in the workspace's shared
 * sidebar, fed by onBoundsChange/onZoneSelect.
 */
export function InundacionesPanelContent({
  onBoundsChange,
  onZoneSelect,
  activeOsmPoints,
}: InundacionesPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de inundaciones"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de inundaciones. El panel de población en el encuadre
          actual, en la barra lateral, resume el mismo contenido en formato de texto.
        </p>
        <GeoglowsLiveMapLoader
          className="relative h-full w-full"
          onBoundsChange={onBoundsChange}
          onZoneSelect={onZoneSelect}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={captionRef} label="Ver pronóstico por estación" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-8 p-4 sm:p-6">
        <div aria-live="polite">
          <MunicipioFloodSummary />
        </div>
        <div aria-live="polite">
          <FloodOverview />
        </div>
        <p className="text-xs text-muted-foreground">
          Pronóstico de río servido en vivo por GEOGLOWS / Esri Living Atlas (capa pública
          GlobalWaterModel_Medium). Susceptibilidad a inundación: capa pública{" "}
          <code className="text-foreground">susceptibilidad_inundaciones</code>, publicada en
          ArcGIS Online. Haz clic sobre cualquier tramo del río o zona para ver su detalle. Esta
          zonificación no cubre Zarzal; la categoría{" "}
          <a
            href="/?categoria=precipitacion"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Precipitación
          </a>{" "}
          sí ofrece un dato de contexto (lluvia acumulada por vereda) para los tres municipios,
          incluido Zarzal.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
