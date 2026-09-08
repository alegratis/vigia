"use client"

import { useCallback, useMemo, useState } from "react"
import { GeoglowsLiveMapLoader } from "@/components/maps/geoglows-live-map-loader"
import { LiveInfrastructureCategories } from "@/components/maps/live-infrastructure-categories"
import { LiveInfrastructureBuildings } from "@/components/maps/live-infrastructure-buildings"
import { useOsmInfrastructure } from "@/lib/osm/use-infrastructure"
import type { OsmCategoryKey } from "@/lib/osm/categories"
import type { MapBounds } from "@/lib/map-bounds"

interface InundacionesPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
  /** Bubbles a clicked river reach/zone's municipio up to the shared sidebar card. */
  onZoneSelect?: (municipio: string) => void
}

/**
 * Expanded inundaciones panel for the homepage workspace: GEOGLOWS' live
 * flood forecast map plus the shared OSM infrastructure row. Demographics
 * now live in the workspace's shared, viewport-based sidebar card, fed by
 * onBoundsChange/onZoneSelect instead of a local LiveAreaPopulation.
 */
export function InundacionesPanelContent({ onBoundsChange, onZoneSelect }: InundacionesPanelContentProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
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
      <div role="region" aria-label="Mapa de inundaciones">
        <p className="sr-only">
          Mapa interactivo de inundaciones. El panel de población en el encuadre
          actual, en la barra lateral, resume el mismo contenido en formato de texto.
        </p>
        <GeoglowsLiveMapLoader
          onBoundsChange={handleBoundsChange}
          onZoneSelect={onZoneSelect}
          osmPoints={activeOsmPoints}
        />
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
        Pronóstico de río servido en vivo por GEOGLOWS / Esri Living Atlas (capa pública
        GlobalWaterModel_Medium). Susceptibilidad a inundación: capa pública{" "}
        <code className="text-foreground">susceptibilidad_inundaciones</code>, publicada en
        ArcGIS Online. Haz clic sobre cualquier tramo del río o zona para ver su detalle.
      </p>
    </div>
  )
}
