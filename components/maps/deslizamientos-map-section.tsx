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

/**
 * Live population-by-threat-level panel + map canvas for the deslizamientos
 * page. Demographics come first as the primary, left-hand column so the
 * map's clicks and pans always have somewhere to report to; mirrors
 * HazardMapSection's layout, but wired to the susceptibility layer's own
 * threat levels instead of DANE-by-viewport. Below that row, the OSM
 * infrastructure breakdown and its building-name list sit side by side,
 * sharing the same toggled categories that also drive the map's markers.
 */
export function DeslizamientosMapSection() {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div aria-live="polite" className="flex flex-col gap-4">
          <LiveThreatPopulation
            selectedLevel={selectedLevel}
            onClearSelection={() => setSelectedLevel(null)}
          />
        </div>
        <div role="region" aria-label="Mapa de susceptibilidad a deslizamiento">
          <p className="sr-only">
            Mapa interactivo de susceptibilidad a deslizamiento. El panel de
            población por nivel de amenaza, a la izquierda, resume el mismo
            contenido en formato de texto.
          </p>
          <DeslizamientosLiveMapLoader
            onBoundsChange={setBounds}
            onPointSelect={setSelectedLevel}
            osmPoints={activeOsmPoints}
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
