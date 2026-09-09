"use client"

import { useRef } from "react"
import { DeslizamientosLiveMapLoader } from "@/components/maps/deslizamientos-live-map-loader"
import { LiveThreatPopulation } from "@/components/deslizamientos/live-threat-population"
import { HazardModelPanel } from "@/components/deslizamientos/hazard-model-panel"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

interface DeslizamientosPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** OSM infrastructure points, filtered to the categories toggled on in the sidebar. */
  activeOsmPoints: OsmPoint[]
  /** Lifted up so the workspace's shared sidebar card can narrow its population figures to this vereda too. */
  selectedVereda: VeredaFeature | null
  onVeredaSelect: (feature: VeredaFeature | null) => void
}

/**
 * Expanded deslizamientos panel for the homepage workspace. The map fills
 * the full first fold so it always takes all the space available; below it,
 * two independent cards scroll in side by side: a population/infrastructure
 * breakdown sourced from RED LabOT's original susceptibility grid (see
 * LiveThreatPopulation), and a "how the hazard is calculated" breakdown of
 * this app's own model — factor weights, a per-municipio summary, and the
 * clicked vereda's own resolved factors (see HazardModelPanel and
 * lib/deslizamientos/hazard-model.ts). The two panels use different level
 * classifications and there's no shared per-point selection between them.
 * `selectedVereda` is owned by the workspace (HazardWorkspace) rather than
 * locally, so the shared sidebar demographics card can also narrow down to
 * whatever vereda is clicked here.
 */
export function DeslizamientosPanelContent({
  onBoundsChange,
  activeOsmPoints,
  selectedVereda,
  onVeredaSelect,
}: DeslizamientosPanelContentProps) {
  const statsRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de amenaza por deslizamiento"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de amenaza por deslizamiento, por vereda. Al hacer
          clic en una vereda, el panel &quot;Cómo se calcula la amenaza&quot;,
          debajo, muestra sus factores. El panel de población por nivel de
          amenaza, debajo, resume un índice relacionado en formato de texto.
        </p>
        <DeslizamientosLiveMapLoader
          className="relative h-full w-full"
          onBoundsChange={onBoundsChange}
          onVeredaSelect={onVeredaSelect}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={statsRef} label="Ver población por amenaza" />
      </div>
      <div ref={statsRef} className="flex flex-col gap-4 p-4 sm:p-6">
        <div aria-live="polite" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LiveThreatPopulation />
          <HazardModelPanel selectedVereda={selectedVereda} onClearSelection={() => onVeredaSelect(null)} />
        </div>
        <p className="text-xs text-muted-foreground">
          El panel de población de la izquierda sigue leyendo el índice{" "}
          <code className="text-foreground">VIGIA_Amenaza_IS</code> de RED LabOT directamente, con su propia
          clasificación — solo cubre Sevilla y Caicedonia. Activa la capa de humedad del suelo (NASA SMAP) para
          contrastar la señal de disparo del modelo propio, o la capa de sitios críticos para ver puntos de daño
          vial verificados en campo (hundimientos, derrumbes, erosión, grietas de tracción) del levantamiento de
          2019 de la Secretaría de Infraestructura del Valle del Cauca — un complemento puntual e histórico, no
          una capa en vivo.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
