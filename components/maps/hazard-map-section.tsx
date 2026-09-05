"use client"

import { useState } from "react"
import { QgisMapCanvas } from "@/components/maps/qgis-map-canvas"
import { QgisExportGuide } from "@/components/maps/qgis-export-guide"
import { GeoglowsLiveMapLoader } from "@/components/maps/geoglows-live-map-loader"
import { LiveAreaPopulation } from "@/components/maps/live-area-population"
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

/** Map canvas + live, viewport-scoped demographics, shared by every hazard page. */
export function HazardMapSection({
  slug,
  title,
  basis,
  basisLabel,
  source = "qgis2web",
}: HazardMapSectionProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div role="region" aria-label={title}>
          <p className="sr-only">
            Mapa interactivo de {title.toLowerCase()}. La tabla de población en el
            encuadre actual, a la derecha, resume el mismo contenido en formato de
            texto.
          </p>
          {source === "geoglows" ? (
            <GeoglowsLiveMapLoader onBoundsChange={setBounds} />
          ) : (
            <QgisMapCanvas slug={slug} title={title} onBoundsChange={setBounds} />
          )}
        </div>
        <div aria-live="polite">
          <LiveAreaPopulation bounds={bounds} basis={basis} basisLabel={basisLabel} />
        </div>
      </div>
      {source === "qgis2web" && <QgisExportGuide slug={slug} />}
      {source === "geoglows" && (
        <p className="text-xs text-muted-foreground">
          Mapa servido en vivo por GEOGLOWS / Esri Living Atlas (capa pública
          GlobalWaterModel_Medium). Haz clic sobre cualquier tramo del río para ver su
          pronóstico actual.
        </p>
      )}
    </div>
  )
}
