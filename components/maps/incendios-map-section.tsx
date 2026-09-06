"use client"

import { useState } from "react"
import { IncendiosLiveMapLoader } from "@/components/maps/incendios-live-map-loader"
import { LiveAreaPopulation } from "@/components/maps/live-area-population"
import type { MapBounds } from "@/lib/map-bounds"

/**
 * Map canvas + live, viewport-scoped demographics for the incendios page.
 * Mirrors DeslizamientosMapSection/HazardMapSection's layout: the map drives
 * `bounds` via BoundsSync, same as the GEOGLOWS flood map, so the
 * demographics panel stays the same component used across every hazard —
 * no new exposure computation yet, per plan.
 */
export function IncendiosMapSection() {
  const [bounds, setBounds] = useState<MapBounds | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div role="region" aria-label="Mapa de amenaza por incendios forestales">
          <p className="sr-only">
            Mapa interactivo de amenaza por incendios forestales, con pronóstico del
            Índice Meteorológico de Incendio. El panel de población en el encuadre
            actual, a la derecha, resume el mismo contenido en formato de texto.
          </p>
          <IncendiosLiveMapLoader onBoundsChange={setBounds} />
        </div>
        <div aria-live="polite">
          <LiveAreaPopulation bounds={bounds} basis="rural" basisLabel="Población rural" />
        </div>
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
  )
}
