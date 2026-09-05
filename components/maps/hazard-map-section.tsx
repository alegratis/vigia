"use client"

import { useState } from "react"
import { QgisMapCanvas } from "@/components/maps/qgis-map-canvas"
import { QgisExportGuide } from "@/components/maps/qgis-export-guide"
import { LiveAreaPopulation } from "@/components/maps/live-area-population"
import type { MapBounds } from "@/lib/map-bounds"

interface HazardMapSectionProps {
  slug: string
  title: string
  basis: "urbano" | "rural"
  basisLabel: string
}

/** Map canvas + live, viewport-scoped demographics, shared by every hazard page. */
export function HazardMapSection({ slug, title, basis, basisLabel }: HazardMapSectionProps) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <QgisMapCanvas slug={slug} title={title} onBoundsChange={setBounds} />
        <LiveAreaPopulation bounds={bounds} basis={basis} basisLabel={basisLabel} />
      </div>
      <QgisExportGuide slug={slug} />
    </div>
  )
}
