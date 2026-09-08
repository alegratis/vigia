"use client"

import { useCallback, useMemo, useState } from "react"
import { QgisMapCanvas } from "@/components/maps/qgis-map-canvas"
import { QgisExportGuide } from "@/components/maps/qgis-export-guide"
import { GeoglowsLiveMapLoader } from "@/components/maps/geoglows-live-map-loader"
import { LiveAreaPopulation } from "@/components/maps/live-area-population"
import { LiveInfrastructureCategories } from "@/components/maps/live-infrastructure-categories"
import { LiveInfrastructureBuildings } from "@/components/maps/live-infrastructure-buildings"
import { useOsmInfrastructure } from "@/lib/osm/use-infrastructure"
import type { OsmCategoryKey } from "@/lib/osm/categories"
import type { MapBounds } from "@/lib/map-bounds"

interface HazardMapSectionProps {
  slug: string
  title: string
  basis: "urbano" | "rural"
  basisLabel: string
  /**
   * "geoglows" renders GEOGLOWS' own live ArcGIS Living Atlas layer directly —
   * no local publishing step needed, since that map already exists and is
   * open and CORS-enabled. "qgis2web" is for hazards without an equivalent
   * open live service, where a local QGIS export is still the right path.
   */
  source?: "geoglows" | "qgis2web"
}

/**
 * Live, viewport-scoped demographics + map canvas, shared by every hazard
 * page. Demographics come first as the primary, left-hand column so the
 * map's clicks and pans always have somewhere to report to. Below that
 * row, the OSM infrastructure breakdown and its building-name list sit
 * side by side, sharing the same toggled categories that also drive the
 * map's markers.
 */
export function HazardMapSection({
  slug,
  title,
  basis,
  basisLabel,
  source = "qgis2web",
}: HazardMapSectionProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [selectedMunicipio, setSelectedMunicipio] = useState<string | null>(null)
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
          <LiveAreaPopulation
            bounds={bounds}
            basis={basis}
            basisLabel={basisLabel}
            selectedMunicipio={selectedMunicipio}
            onClearSelection={() => setSelectedMunicipio(null)}
          />
        </div>
        <div role="region" aria-label={title}>
          <p className="sr-only">
            Mapa interactivo de {title.toLowerCase()}. La tabla de población en el
            encuadre actual, a la izquierda, resume el mismo contenido en formato de
            texto.
          </p>
          {source === "geoglows" ? (
            <GeoglowsLiveMapLoader
              onBoundsChange={setBounds}
              onZoneSelect={setSelectedMunicipio}
              osmPoints={activeOsmPoints}
            />
          ) : (
            <QgisMapCanvas slug={slug} title={title} onBoundsChange={setBounds} />
          )}
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
      {source === "qgis2web" && <QgisExportGuide slug={slug} />}
      {source === "geoglows" && (
        <p className="text-xs text-muted-foreground">
          Pronóstico de río servido en vivo por GEOGLOWS / Esri Living Atlas (capa pública
          GlobalWaterModel_Medium). Susceptibilidad a inundación: capa pública{" "}
          <code className="text-foreground">susceptibilidad_inundaciones</code>, publicada en
          ArcGIS Online. Haz clic sobre cualquier tramo del río o zona para ver su detalle.
        </p>
      )}
    </div>
  )
}
