"use client"

import dynamic from "next/dynamic"
import { useRef } from "react"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import type { MapBounds } from "@/lib/map-bounds"

const DemografiaLiveMap = dynamic(
  () => import("@/components/maps/demografia-live-map").then((m) => m.DemografiaLiveMap),
  { ssr: false },
)

interface DemografiaPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
}

/**
 * Expanded Demografía panel for the homepage workspace, mirroring
 * `SismologiaPanelContent`'s structure: the 3D indicator map fills the full
 * first fold; a short explainer and source caption scroll in below.
 */
export function DemografiaPanelContent({ onBoundsChange }: DemografiaPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa 3D de indicadores demográficos"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo en 3D con dos indicadores del geoportal de DANE: el índice de pobreza
          multidimensional por municipio y las cifras de viviendas, hogares y personas por manzana
          censal, para Sevilla, Caicedonia, Zarzal y Roldanillo.
        </p>
        <DemografiaLiveMap className="relative isolate h-full w-full" onBoundsChange={onBoundsChange} />
        <ScrollHintButton targetRef={captionRef} label="Ver más sobre estos indicadores" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Las columnas 3D representan, según el indicador activo en el panel de la derecha, el
            índice de pobreza multidimensional (IPM) por municipio o el número de viviendas, hogares
            o personas por manzana censal — mientras más alta y más intensa la columna, mayor el
            valor del indicador en ese lugar.
          </p>
          <p>
            El índice de vulnerabilidad compuesto, que combina esta condición social con el riesgo
            físico ya calculado en{" "}
            <a href="/?categoria=riesgo-compuesto" className="underline underline-offset-2 hover:text-foreground">
              Riesgo compuesto
            </a>
            , se añade como una tercera capa en este mismo mapa.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Fuente:{" "}
          <a
            href="https://geoportal.dane.gov.co/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Geoportal del DANE
          </a>{" "}
          — índice de pobreza multidimensional (
          <a
            href="https://geoportal.dane.gov.co/visipm"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            visipm
          </a>
          ) y estadísticas integradas del Censo Nacional de Población y Vivienda 2018 (
          <a
            href="https://geoportal.dane.gov.co/geovisores/sociedad/estadisticas-integradas/?cod_dimension=1"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            estadísticas integradas
          </a>
          ). Ambos son servicios públicos de ArcGIS del DANE, consultados por código de municipio.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
