"use client"

import { useRef } from "react"
import { SismologiaLiveMapLoader } from "@/components/maps/sismologia-live-map-loader"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import { SismologiaOverview } from "@/components/sismologia/sismologia-overview"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

interface SismologiaPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** Bubbles a clicked vereda (via the map's "Límites veredales" overlay) up to the shared sidebar card. */
  onVeredaSelect?: (feature: VeredaFeature) => void
  /** OSM infrastructure points, filtered to the categories toggled on in the sidebar. */
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded sismología panel for the homepage workspace, mirroring
 * `IncendiosPanelContent`'s structure: the seismic-activity map fills the
 * full first fold; its summary stats and source caption scroll in below.
 */
export function SismologiaPanelContent({
  onBoundsChange,
  onVeredaSelect,
  activeOsmPoints,
}: SismologiaPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de actividad sísmica"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de actividad sísmica, con epicentros en vivo del Servicio Geológico de
          Estados Unidos (USGS) y el catálogo histórico del Servicio Geológico Colombiano (SGC), más
          un resumen opcional de reportes comunitarios de daños en Sevilla.
        </p>
        <SismologiaLiveMapLoader
          className="relative isolate h-full w-full"
          onBoundsChange={onBoundsChange}
          onVeredaSelect={onVeredaSelect}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={captionRef} label="Ver resumen de actividad sísmica" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div aria-live="polite">
          <SismologiaOverview />
        </div>
        <p className="text-xs text-muted-foreground">
          Actividad en vivo (últimos 90 días): servicio público{" "}
          <a
            href="https://earthquake.usgs.gov/fdsnws/event/1/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            USGS FDSN Event Web Service
          </a>
          , catálogo global en tiempo casi real. Catálogo histórico: servicio abierto del{" "}
          <a
            href="https://www.sgc.gov.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Servicio Geológico Colombiano
          </a>
          , el registro sísmico oficial de Colombia — no es un feed en vivo, por lo que se muestra
          como una capa aparte, punteada en el mapa. El{" "}
          <a
            href="https://osso.univalle.edu.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Observatorio Sismológico del Suroccidente (OSSO/Univalle)
          </a>{" "}
          publica boletines propios sin un servicio de datos abierto; se referencia aquí como fuente
          adicional. Los reportes de daños de Sevilla provienen de un formulario de campo comunitario
          (Survey123) agregado por barrio — sin verificar, y sin exponer direcciones ni cifras de
          heridos o fallecidos por hogar. Esta categoría no tiene una zonificación de amenaza sísmica
          por vereda publicada; el aporte al riesgo compuesto se calcula por distancia a los
          epicentros — ver{" "}
          <a href="/?categoria=riesgo-compuesto" className="underline underline-offset-2 hover:text-foreground">
            Riesgo compuesto
          </a>
          .
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
