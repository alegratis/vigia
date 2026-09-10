"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { LatLngBoundsExpression } from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2 } from "lucide-react"
import { COMPOUND_LEVELS, compoundLevelColorToken } from "@/lib/riesgo-compuesto/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { BasemapTileLayer } from "@/components/maps/basemap-tile-layer"
import { CompoundVeredasOverlay } from "@/components/maps/compound-veredas-overlay"
import { CompoundReportDialog } from "@/components/riesgo-compuesto/compound-report-dialog"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { useCompoundVeredas } from "@/lib/riesgo-compuesto/use-compound-veredas"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { CompoundFeature } from "@/lib/riesgo-compuesto/api-types"

// Same AOI as the other three vereda maps (Sevilla, Caicedonia, Zarzal).
const AOI_CENTER: [number, number] = [4.16, -75.89]
const AOI_BOUNDS: LatLngBoundsExpression = [
  [3.88, -76.06],
  [4.44, -75.72],
]

function BoundsSync({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
  const map = useMap()

  const sync = useCallback(() => {
    const b = map.getBounds()
    onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
  }, [map, onBoundsChange])

  useEffect(() => {
    sync()
  }, [sync])

  useMapEvents({ moveend: sync, zoomend: sync, resize: sync })

  return null
}

function Legend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(COMPOUND_LEVELS.map((level) => resolveCssColor(compoundLevelColorToken(level))))
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Riesgo compuesto</p>
      <ul className="flex flex-col gap-1">
        {COMPOUND_LEVELS.map((level, i) => (
          <li key={level} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors?.[i] ?? "transparent" }}
              aria-hidden="true"
            />
            {level}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Compound multi-hazard map: shades each vereda by the max-ordinal tier
 * across this app's four hazard models (see
 * lib/riesgo-compuesto/compound-model.ts), rather than any single live
 * layer — no GEOGLOWS/reach layer here, this category is the static
 * per-vereda compound picture. Click a vereda for its 4-hazard breakdown,
 * then "Ver reporte completo" for the full narrative report.
 */
function CompoundLiveMapImpl({
  onBoundsChange,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onVeredaSelect?: (feature: CompoundFeature) => void
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const osmColors = useOsmCategoryColors()
  const { error: veredasError, isLoading: veredasLoading } = useCompoundVeredas(true)
  const [reportFeature, setReportFeature] = useState<CompoundFeature | null>(null)

  return (
    <div
      className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}
    >
      <MapContainer
        center={AOI_CENTER}
        zoom={11}
        minZoom={9}
        maxZoom={16}
        bounds={AOI_BOUNDS}
        zoomControl={false}
        attributionControl={false}
        preferCanvas
        className="h-full w-full"
      >
        <ZoomControl position="topright" />
        <AttributionControl position="bottomright" prefix="Leaflet" />
        <BasemapTileLayer />
        <CompoundVeredasOverlay
          enabled
          onSelect={onVeredaSelect}
          onOpenReport={setReportFeature}
        />
        {osmColors &&
          osmPoints?.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={5}
              pathOptions={{ color: "#fff", weight: 1, fillColor: osmColors[p.category], fillOpacity: 0.9 }}
            >
              <Popup>
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong>{p.name ?? getOsmCategory(p.category).label}</strong>
                  <span>{getOsmCategory(p.category).label}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        {onBoundsChange && <BoundsSync onBoundsChange={onBoundsChange} />}
      </MapContainer>
      {veredasLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      {veredasError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <span className="text-sm text-destructive">No se pudo cargar la capa.</span>
        </div>
      )}
      <div className="absolute right-3 top-3 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      <Legend />
      <CompoundReportDialog feature={reportFeature} onOpenChange={(open) => !open && setReportFeature(null)} />
    </div>
  )
}

export default CompoundLiveMapImpl
