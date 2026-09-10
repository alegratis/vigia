"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { BasemapTileLayer } from "@/components/maps/basemap-tile-layer"
import { VeredasOverlay } from "@/components/maps/veredas-overlay"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { getOsmCategory } from "@/lib/osm/categories"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { useSismologiaDanos, useSismologiaEventos } from "@/lib/sismologia/use-sismologia"
import {
  SEISMIC_MAGNITUDE_LEVELS,
  SEISMIC_MAGNITUDE_LEVEL_STYLES,
  magnitudeLevel,
  magnitudeRadius,
} from "@/lib/sismologia/levels"
import type { SeismicEvent } from "@/lib/sismologia/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

// Same AOI viewport as the other hazard maps — the server-side query bbox (lib/sismologia/server.ts)
// is padded wider than this to catch nearby regional events that still influence exposure.
const AOI_CENTER: [number, number] = [4.28, -75.9]
const AOI_BOUNDS: LatLngBoundsExpression = [
  [3.88, -76.06],
  [4.44, -75.72],
]

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface BoundsSyncProps {
  onBoundsChange: (bounds: MapBounds) => void
}

function BoundsSync({ onBoundsChange }: BoundsSyncProps) {
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

function MagnitudeLegend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(SEISMIC_MAGNITUDE_LEVELS.map((level) => resolveCssColor(SEISMIC_MAGNITUDE_LEVEL_STYLES[level].colorToken)))
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Magnitud</p>
      <ul className="flex flex-col gap-1">
        {SEISMIC_MAGNITUDE_LEVELS.map((level, i) => (
          <li key={level} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors?.[i] ?? "transparent" }}
              aria-hidden="true"
            />
            {level} <span className="text-muted-foreground/70">({SEISMIC_MAGNITUDE_LEVEL_STYLES[level].range})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DamageReportsPanel() {
  const { data, isLoading } = useSismologiaDanos(true)

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-[400] max-h-[60%] w-64 overflow-y-auto rounded-md border border-border bg-card/95 px-3 py-2.5 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Reportes de daños — Sevilla</p>
      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {data && (
        <>
          <p className="mb-2 text-muted-foreground">
            {data.totalReportes} reportes comunitarios, sin verificar, agregados por barrio.
          </p>
          <ul className="flex flex-col gap-1.5">
            {data.barrios.map((b) => (
              <li key={b.barrio} className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5 first:border-0 first:pt-0">
                <span className="text-foreground">{b.barrio}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{b.totalReportes}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * Live seismic-activity map: USGS's real-time FDSN event feed (last 90
 * días) plus SGC's historical catalog for the region, each independently
 * toggleable and styled distinctly (SGC as a muted outline marker, USGS
 * filled) since they answer different questions — "what just happened"
 * vs. "what has this region historically produced." Also offers an
 * optional Sevilla-only community damage-report summary (Survey123, never
 * showing individual points or victim counts — see
 * lib/sismologia/survey-damage.ts) and the shared vereda-boundary overlay
 * for population/infrastructure context.
 */
function SismologiaLiveMapImpl({
  onBoundsChange,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onVeredaSelect?: (feature: VeredaFeature) => void
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const { data } = useSismologiaEventos()
  const osmColors = useOsmCategoryColors()

  const [showUsgs, setShowUsgs] = useState(true)
  const [showSgc, setShowSgc] = useState(true)
  const [showDamage, setShowDamage] = useState(false)
  const [showVeredas, setShowVeredas] = useState(false)
  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    const entries = SEISMIC_MAGNITUDE_LEVELS.map(
      (level) => [level, resolveCssColor(SEISMIC_MAGNITUDE_LEVEL_STYLES[level].colorToken)] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
  }, [])

  const visibleEvents = useMemo(() => {
    if (!data) return []
    const list: SeismicEvent[] = []
    if (showUsgs) list.push(...data.usgs.events)
    if (showSgc) list.push(...data.sgc.events)
    return list
  }, [data, showUsgs, showSgc])

  return (
    <div
      className={
        className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"
      }
    >
      <MapContainer
        center={AOI_CENTER}
        zoom={9}
        minZoom={7}
        maxZoom={16}
        bounds={AOI_BOUNDS}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <ZoomControl position="topright" />
        <AttributionControl position="bottomright" prefix="Leaflet" />
        <BasemapTileLayer />
        <VeredasOverlay enabled={showVeredas} onSelect={onVeredaSelect} />
        {resolvedColors &&
          visibleEvents.map((event) => {
            const color = resolvedColors[magnitudeLevel(event.magnitude)]
            const isSgc = event.source === "sgc"
            return (
              <CircleMarker
                key={event.id}
                center={[event.lat, event.lon]}
                radius={magnitudeRadius(event.magnitude)}
                pathOptions={
                  isSgc
                    ? { color, weight: 2, fillColor: color, fillOpacity: 0.15, dashArray: "2 3" }
                    : { color: "#fff", weight: 1, fillColor: color, fillOpacity: 0.85 }
                }
              >
                <Popup>
                  <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                    <strong>M {event.magnitude.toFixed(1)}</strong>
                    <span>{event.place ?? "Catálogo histórico SGC"}</span>
                    <span>{formatDateTime(event.time)}</span>
                    {event.depthKm != null && <span>Profundidad: {event.depthKm.toFixed(1)} km</span>}
                    <span>Fuente: {isSgc ? "SGC (histórico)" : "USGS (en vivo)"}</span>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
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

      <div className="absolute left-3 top-3 z-[400] flex flex-col gap-1.5 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input type="checkbox" checked={showUsgs} onChange={(e) => setShowUsgs(e.target.checked)} className="size-3.5 accent-primary" />
          USGS en vivo (90 días)
        </label>
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input type="checkbox" checked={showSgc} onChange={(e) => setShowSgc(e.target.checked)} className="size-3.5 accent-primary" />
          SGC histórico
        </label>
        <label className="flex items-center gap-2 border-t border-border pt-1.5 font-medium text-foreground">
          <input type="checkbox" checked={showVeredas} onChange={(e) => setShowVeredas(e.target.checked)} className="size-3.5 accent-primary" />
          Límites veredales
        </label>
        <label className="flex items-center gap-2 border-t border-border pt-1.5 font-medium text-foreground">
          <input type="checkbox" checked={showDamage} onChange={(e) => setShowDamage(e.target.checked)} className="size-3.5 accent-primary" />
          Reportes de daños (Sevilla)
        </label>
      </div>

      <MagnitudeLegend />
      {showDamage && <DamageReportsPanel />}
    </div>
  )
}

export default SismologiaLiveMapImpl
