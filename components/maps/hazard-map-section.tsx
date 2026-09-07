"use client"

import { useState } from "react"
import { QgisMapCanvas } from "@/components/maps/qgis-map-canvas"
import { QgisExportGuide } from "@/components/maps/qgis-export-guide"
import { GeoglowsLiveMapLoader } from "@/components/maps/geoglows-live-map-loader"
import { LiveAreaPopulation } from "@/components/maps/live-area-population"
import { LiveInfrastructureCategories } from "@/components/maps/live-infrastructure-categories"
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
 * map's clicks and pans always have somewhere to report to.
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div aria-live="polite" className="flex flex-col gap-4">
          <LiveAreaPopulation
            bounds={bounds}
            basis={basis}
            basisLabel={basisLabel}
            selectedMunicipio={selectedMunicipio}
            onClearSelection={() => setSelectedMunicipio(null)}
          />
          <LiveInfrastructureCategories bounds={bounds} />
        </div>
        <div role="region" aria-label={title}>
          <p className="sr-only">
            Mapa interactivo de {title.toLowerCase()}. La tabla de población en el
            encuadre actual, a la izquierda, resume el mismo contenido en formato de
            texto.
          </p>
          {source === "geoglows" ? (
            <GeoglowsLiveMapLoader onBoundsChange={setBounds} onZoneSelect={setSelectedMunicipio} />
          ) : (
            <QgisMapCanvas slug={slug} title={title} onBoundsChange={setBounds} />
          )}
        </div>
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
