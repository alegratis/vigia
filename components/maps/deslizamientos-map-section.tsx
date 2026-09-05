"use client"

import { DeslizamientosLiveMapLoader } from "@/components/maps/deslizamientos-live-map-loader"
import { LiveThreatPopulation } from "@/components/deslizamientos/live-threat-population"

/**
 * Map canvas + live population-by-threat-level panel for the deslizamientos
 * page. Mirrors HazardMapSection's layout, but wired to the susceptibility
 * layer's own threat levels instead of DANE-by-viewport.
 */
export function DeslizamientosMapSection() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div role="region" aria-label="Mapa de susceptibilidad a deslizamiento">
          <p className="sr-only">
            Mapa interactivo de susceptibilidad a deslizamiento. El panel de
            población por nivel de amenaza, a la derecha, resume el mismo
            contenido en formato de texto.
          </p>
          <DeslizamientosLiveMapLoader />
        </div>
        <div aria-live="polite">
          <LiveThreatPopulation />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Capa pública <code className="text-foreground">amenaza_por_deslizamiento</code>, publicada en
        ArcGIS Online. Haz clic sobre cualquier zona para ver su municipio y nivel de susceptibilidad.
      </p>
    </div>
  )
}
