"use client"

import { useCallback, useMemo, useState } from "react"
import { DeslizamientosLiveMapLoader } from "@/components/maps/deslizamientos-live-map-loader"
import { LiveThreatPopulation } from "@/components/deslizamientos/live-threat-population"
import { LiveInfrastructureCategories } from "@/components/maps/live-infrastructure-categories"
import { LiveInfrastructureBuildings } from "@/components/maps/live-infrastructure-buildings"
import { useOsmInfrastructure } from "@/lib/osm/use-infrastructure"
import type { OsmCategoryKey } from "@/lib/osm/categories"
import type { SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import type { MapBounds } from "@/lib/map-bounds"

interface DeslizamientosPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
}

/**
 * Expanded deslizamientos panel for the homepage workspace. The
 * susceptibility layer's points carry a threat level, not a municipio, so
 * its own population/infrastructure breakdown by level stays local here
 * rather than feeding the shared, viewport-based sidebar card — only
 * `bounds` is reported up, same as the other two hazards.
 */
export function DeslizamientosPanelContent({ onBoundsChange }: DeslizamientosPanelContentProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<SusceptibilityLevel | null>(null)
  const { points: osmPoints, isLoading: osmLoading, error: osmError } = useOsmInfrastructure()
  const [activeOsmCategories, setActiveOsmCategories] = useState<Set<OsmCategoryKey>>(new Set())

  const toggleOsmCategory = useCallback((key: OsmCategoryKey) => {
    setActiveOsmCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const activeOsmPoints = useMemo(
    () => osmPoints?.filter((p) => activeOsmCategories.has(p.category)) ?? [],
    [osmPoints, activeOsmCategories],
  )

  const handleBoundsChange = useCallback(
    (b: MapBounds) => {
      setBounds(b)
      onBoundsChange?.(b)
    },
    [onBoundsChange],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div role="region" aria-label="Mapa de susceptibilidad a deslizamiento">
          <p className="sr-only">
            Mapa interactivo de susceptibilidad a deslizamiento. El panel de
            población por nivel de amenaza, a la derecha, resume el mismo
            contenido en formato de texto.
          </p>
          <DeslizamientosLiveMapLoader
            onBoundsChange={handleBoundsChange}
            onPointSelect={setSelectedLevel}
            osmPoints={activeOsmPoints}
          />
        </div>
        <div aria-live="polite" className="flex flex-col gap-4">
          <LiveThreatPopulation
            selectedLevel={selectedLevel}
            onClearSelection={() => setSelectedLevel(null)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LiveInfrastructureCategories
          bounds={bounds}
          points={osmPoints}
          isLoading={osmLoading}
          error={osmError}
          activeCategories={activeOsmCategories}
          onToggleCategory={toggleOsmCategory}
        />
        <LiveInfrastructureBuildings
          bounds={bounds}
          points={osmPoints}
          activeCategories={activeOsmCategories}
        />
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
