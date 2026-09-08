"use client"

import { GeoglowsLiveMapLoader } from "@/components/maps/geoglows-live-map-loader"
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
 * flood forecast map fills the full first fold; its source caption scrolls
 * in below. Demographics and infrastructure toggles live in the workspace's
 * shared sidebar, fed by onBoundsChange/onZoneSelect.
 */
export function InundacionesPanelContent({
  onBoundsChange,
  onZoneSelect,
  activeOsmPoints,
}: InundacionesPanelContentProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div role="region" aria-label="Mapa de inundaciones" className="h-[70vh] min-h-[420px] shrink-0 lg:h-full">
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
      </div>
      <div className="p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">
          Pronóstico de río servido en vivo por GEOGLOWS / Esri Living Atlas (capa pública
          GlobalWaterModel_Medium). Susceptibilidad a inundación: capa pública{" "}
          <code className="text-foreground">susceptibilidad_inundaciones</code>, publicada en
          ArcGIS Online. Haz clic sobre cualquier tramo del río o zona para ver su detalle.
        </p>
      </div>
    </div>
  )
}
