"use client"

import { useRef, useState } from "react"
import { CompoundLiveMapLoader } from "@/components/maps/compound-live-map-loader"
import { CompoundModelPanel } from "@/components/riesgo-compuesto/compound-model-panel"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { CompoundFeature } from "@/lib/riesgo-compuesto/api-types"

interface RiesgoCompuestoPanelContentProps {
  onBoundsChange?: (bounds: MapBounds) => void
  activeOsmPoints: OsmPoint[]
}

/**
 * Expanded riesgo-compuesto panel for the homepage workspace, mirroring
 * `DeslizamientosPanelContent`'s structure: the map fills the full first
 * fold, and the "how it's calculated" panel scrolls in below. Unlike the
 * other three categories, this one keeps its own `selectedVereda` state
 * locally rather than lifting it to the workspace's shared sidebar card —
 * the compound category has no equivalent DANE population basis of its
 * own (it's a combination of the other four), so there's nothing for the
 * shared sidebar card to narrow down to here.
 */
export function RiesgoCompuestoPanelContent({ onBoundsChange, activeOsmPoints }: RiesgoCompuestoPanelContentProps) {
  const [selectedVereda, setSelectedVereda] = useState<CompoundFeature | null>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de riesgo compuesto"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo de riesgo compuesto por vereda, combinando deslizamientos, inundaciones,
          incendios forestales y precipitación. Al hacer clic en una vereda se abre un resumen de las cuatro
          amenazas con un botón para ver el reporte completo.
        </p>
        <CompoundLiveMapLoader
          className="relative isolate h-full w-full"
          onBoundsChange={onBoundsChange}
          onVeredaSelect={setSelectedVereda}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={statsRef} label="Ver cómo se calcula" />
      </div>
      <div ref={statsRef} className="flex flex-col gap-4 p-4 sm:p-6">
        <CompoundModelPanel selectedVereda={selectedVereda} onClearSelection={() => setSelectedVereda(null)} />
        <p className="text-xs text-muted-foreground">
          Haz clic en &quot;Ver reporte completo&quot; dentro del popup de cualquier vereda para el desglose
          narrativo de las cuatro amenazas, la exposición demográfica y la metodología detallada.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
