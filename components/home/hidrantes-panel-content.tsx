"use client"

import { useRef } from "react"
import { HidrantesLiveMapLoader } from "@/components/maps/hidrantes-live-map-loader"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import { CollapsibleMobileSection } from "@/components/home/collapsible-mobile-section"

/**
 * Expanded hidrantes panel for the homepage workspace: a Sevilla-only map
 * that geolocates the user (or takes a map click as the reference point
 * instead), highlights the closest fire hydrant, and draws a route to it.
 * Unlike every other category, this one has no vereda/municipio toggles or
 * demographics tie-in — it's a single-purpose operational tool for
 * firefighters, so the content below the map is just what the layer is and
 * where it covers, not methodology.
 */
export function HidrantesPanelContent() {
  const captionRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de hidrantes de Sevilla, casco urbano"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de hidrantes en el casco urbano de Sevilla. Ubica tu posición o un punto elegido en el
          mapa y resalta el hidrante más cercano con una ruta sugerida.
        </p>
        <HidrantesLiveMapLoader className="relative isolate h-full w-full" />
        <ScrollHintButton targetRef={captionRef} label="Ver detalles de la capa" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-8 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Hidrantes en Sevilla, casco urbano</h3>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Esta capa ubica cada hidrante disponible en el casco urbano de Sevilla y, a partir de tu ubicación —o de
            un punto que elijas en el mapa—, resalta el más cercano con una ruta aproximada por calles. Está pensada
            como herramienta operativa para el cuerpo de bomberos: si no estás en Sevilla, puedes hacer clic en
            cualquier punto del mapa para consultar el hidrante más próximo a ese lugar.
          </p>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            Disponible únicamente para Sevilla, casco urbano; no se replica en los demás municipios ni veredas que
            cubre el resto de la aplicación.
          </p>
        </div>
        <CollapsibleMobileSection title="Fuentes y metodología">
          <p className="text-xs text-muted-foreground">
            Ubicación del usuario: geolocalización del navegador, con un clic en el mapa como alternativa siempre
            disponible. Hidrante más cercano: distancia en línea recta entre el punto de referencia y cada hidrante
            de la capa. Ruta trazada: servicio público de{" "}
            <a
              href="https://project-osrm.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              OSRM
            </a>
            , sin indicaciones paso a paso; si no está disponible, se muestra una línea recta en su lugar.
          </p>
        </CollapsibleMobileSection>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
