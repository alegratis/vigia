"use client"

import { useRef, useState } from "react"
import { ClimaLiveMapLoader } from "@/components/maps/clima-live-map-loader"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import { DecadalChart } from "@/components/clima/decadal-chart"
import { QuinquenalChart } from "@/components/clima/quinquenal-chart"
import { CollapsibleMobileSection } from "@/components/home/collapsible-mobile-section"
import { WeatherReportCard } from "@/components/clima/weather-report-card"
import type { ClimaVeredaProperties } from "@/lib/clima/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

interface ClimaPanelContentProps {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  onVeredaFeatureSelect?: (feature: VeredaFeature | null) => void
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded clima panel for the homepage workspace: the vereda weather map
 * fills the first fold; below it, a detailed report card for the clicked
 * vereda (current conditions + 7-day strip) and the source caption scroll
 * in. Like precipitación, this layer covers all three municipios including
 * Zarzal. Demographics and infrastructure toggles live in the workspace's
 * shared sidebar, fed by onBoundsChange/onZoneSelect/onVeredaFeatureSelect.
 */
export function ClimaPanelContent({
  onBoundsChange,
  onZoneSelect,
  onVeredaFeatureSelect,
  activeOsmPoints,
}: ClimaPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [selectedClima, setSelectedClima] = useState<ClimaVeredaProperties | null>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de clima"
        className="relative h-[calc(100dvh-6rem)] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo del estado del tiempo por vereda, con la temperatura actual y las condiciones del cielo,
          y un marcador de condiciones actuales por municipio. Al hacer clic sobre una vereda se muestra su pronóstico
          a 7 días en la tarjeta bajo el mapa. El panel de población en el encuadre actual, en la barra lateral, resume
          el mismo contenido en formato de texto.
        </p>
        <ClimaLiveMapLoader
          className="relative isolate h-full w-full"
          onBoundsChange={onBoundsChange}
          onZoneSelect={onZoneSelect}
          onVeredaFeatureSelect={onVeredaFeatureSelect}
          onClimaSelect={setSelectedClima}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={captionRef} label="Ver pronóstico y fuentes" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div aria-live="polite">
          <WeatherReportCard vereda={selectedClima} />
        </div>
        <div aria-live="polite">
          <DecadalChart
            vereda={
              selectedClima
                ? { codigoVereda: selectedClima.codigoVereda, nombre: selectedClima.nombre, municipio: selectedClima.municipio }
                : null
            }
          />
        </div>
        <div aria-live="polite">
          <QuinquenalChart
            vereda={
              selectedClima
                ? { codigoVereda: selectedClima.codigoVereda, nombre: selectedClima.nombre, municipio: selectedClima.municipio }
                : null
            }
          />
        </div>
        <CollapsibleMobileSection title="Fuentes y metodología">
          <p className="text-xs text-muted-foreground">
            Reporte meteorológico por vereda con datos de{" "}
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Open-Meteo
            </a>{" "}
            (temperatura, código de estado del tiempo WMO y pronóstico a 7 días, a partir de modelos numéricos de
            pronóstico del tiempo, no de observación directa). A diferencia de la mayoría de las capas, esta cubre
            Zarzal y Roldanillo con el mismo detalle que Sevilla y Caicedonia. Haz clic sobre cualquier vereda para
            ver su pronóstico completo.
          </p>
        </CollapsibleMobileSection>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
