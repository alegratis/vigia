"use client"

import { useRef, useState } from "react"
import { PrecipitacionLiveMapLoader } from "@/components/maps/precipitacion-live-map-loader"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { PrecipitationOverview } from "@/components/precipitacion/precipitation-overview"
import { ClimatologyChart, type SelectedVereda } from "@/components/precipitacion/climatology-chart"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

interface PrecipitacionPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** Bubbles a clicked vereda's municipio up to the shared sidebar card. */
  onZoneSelect?: (municipio: string) => void
  /** OSM infrastructure points, filtered to the categories toggled on in the sidebar. */
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded precipitación panel for the homepage workspace: the vereda
 * rainfall-accumulation map fills the full first fold; its source caption
 * scrolls in below. This is the only hazard category with full coverage
 * of all three municipios, including Zarzal — see lib/precipitacion/server.ts.
 * Demographics and infrastructure toggles live in the workspace's shared
 * sidebar, fed by onBoundsChange/onZoneSelect.
 */
export function PrecipitacionPanelContent({
  onBoundsChange,
  onZoneSelect,
  activeOsmPoints,
}: PrecipitacionPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)
  const [selectedVereda, setSelectedVereda] = useState<SelectedVereda | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        role="region"
        aria-label="Mapa de precipitación"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de lluvia acumulada o pronosticada por vereda, con controles
          para elegir el modo (histórico o pronóstico), en modo histórico la fuente
          (NASA POWER o estaciones IDEAM) y la ventana de días, además de una capa
          satelital de tasa de precipitación. El panel de población en el encuadre
          actual, en la barra lateral, resume el mismo contenido en formato de texto.
        </p>
        <PrecipitacionLiveMapLoader
          className="relative h-full w-full"
          onBoundsChange={onBoundsChange}
          onZoneSelect={onZoneSelect}
          onVeredaSelect={setSelectedVereda}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={captionRef} label="Ver resumen por municipio" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div aria-live="polite">
          <ClimatologyChart vereda={selectedVereda} />
        </div>
        <div aria-live="polite">
          <PrecipitationOverview />
        </div>
        <p className="text-xs text-muted-foreground">
          Modo histórico: lluvia acumulada por vereda en la ventana de días elegida (7,
          14 o 30), con el dato más reciente válido de{" "}
          <a
            href="https://power.larc.nasa.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            NASA POWER
          </a>{" "}
          (reanálisis MERRA-2/GEOS-IT, no satelital directo, ~0.5° de resolución), o —
          eligiendo la fuente IDEAM en el mapa — de las estaciones automáticas de{" "}
          <a
            href="https://www.datos.gov.co/resource/s54a-sgyg.json"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            IDEAM
          </a>{" "}
          (lecturas cada 10 min, más precisas pero solo cerca de Zarzal y Bugalagrande;
          las demás veredas quedan sin cobertura). Modo pronóstico: lluvia prevista por
          vereda a 7 o 14 días de{" "}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Open-Meteo
          </a>{" "}
          (modelos numéricos de pronóstico del tiempo, no observación directa). Capa
          satelital de tasa de precipitación: GPM IMERG vía NASA GIBS. A diferencia de las
          demás capas de amenaza, esta cubre Zarzal con el mismo detalle que Sevilla y
          Caicedonia. Los umbrales de nivel son un criterio simple de referencia, no un
          modelo de amenaza calibrado. Haz clic sobre cualquier vereda para ver su detalle
          y actualizar el histograma de lluvia normal mensual que aparece arriba.
        </p>
      </div>
    </div>
  )
}
