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
        Índice de susceptibilidad <code className="text-foreground">VIGIA_Amenaza_IS</code> (RED
        LabOT), publicado en ArcGIS Online. Haz clic sobre cualquier punto para ver su municipio y
        nivel de susceptibilidad. Activa la capa de humedad del suelo (NASA SMAP) para ver la señal
        de disparo antecedente.
      </p>
    </div>
  )
}
