"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  TileLayer,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { LatLngBoundsExpression } from "leaflet"
import "leaflet/dist/leaflet.css"
import { ExternalLink, Loader2 } from "lucide-react"
import useSWR from "swr"
import {
  SUSCEPTIBILITY_LEVELS,
  SUSCEPTIBILITY_LEVEL_STYLES,
  levelColorToken,
  type SusceptibilityLevel,
} from "@/lib/deslizamientos/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { SMAP_TILE_URL, SMAP_WORLDVIEW_URL } from "@/lib/deslizamientos/smap"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import type { DeslizamientosResponse } from "@/lib/deslizamientos/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

// Fallback center if bounds-fitting is unavailable — the midpoint of AOI_BOUNDS below.
const AOI_CENTER: [number, number] = [4.16, -75.89]

/**
 * Frames Sevilla and Caicedonia's full susceptibility extent (queried live
 * from the ArcGIS layer's envelope, west/south/east/north = -76.04/3.90/
 * -75.74/4.42, with a small margin). The map previously used a fixed center
 * pinned to the extent's northern edge, which showed only the northern
 * sliver of Sevilla and cropped out the rural, mountainous south where most
 * of the susceptibility zones sit.
 */
const AOI_BOUNDS: LatLngBoundsExpression = [
  [3.88, -76.06],
  [4.44, -75.72],
]

const fetcher = async (url: string): Promise<DeslizamientosResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de deslizamientos")
  return res.json()
}

interface BoundsSyncProps {
  onBoundsChange: (bounds: MapBounds) => void
}

function BoundsSync({ onBoundsChange }: BoundsSyncProps) {
  const map = useMap()

  const sync = useCallback(() => {
    const b = map.getBounds()
    onBoundsChange({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    })
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
    setColors(SUSCEPTIBILITY_LEVELS.map((level) => resolveCssColor(levelColorToken(level))))
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Susceptibilidad a deslizamiento</p>
      <ul className="flex flex-col gap-1">
        {SUSCEPTIBILITY_LEVELS.map((level, i) => (
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

interface SoilMoistureControlProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * Toggle + link-out for the SMAP root-zone soil moisture overlay, the
 * landslide trigger signal (antecedent soil moisture) that complements the
 * static susceptibility index. No legend is fabricated here — GIBS doesn't
 * publish one for this layer, so the caption links to NASA Worldview's own
 * color scale instead.
 */
function SoilMoistureControl({ checked, onCheckedChange }: SoilMoistureControlProps) {
  return (
    <div className="absolute left-3 top-3 z-[400] flex flex-col gap-1.5 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <label className="flex items-center gap-2 font-medium text-foreground">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="size-3.5 accent-primary"
        />
        Humedad del suelo (SMAP)
      </label>
      {checked && (
        <a
          href={SMAP_WORLDVIEW_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Ver escala en Worldview
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}

/**
 * Live landslide susceptibility map: renders RED LabOT's
 * `VIGIA_Amenaza_IS_Puntos` index — 11,721 points across Sevilla and
 * Caicedonia — as canvas-rendered dots over OpenStreetMap, optionally
 * overlaid with NASA GIBS's SMAP root-zone soil moisture (the antecedent
 * moisture trigger signal). Click a point for its municipality and threat
 * level.
 */
function DeslizamientosLiveMapImpl({
  onBoundsChange,
  onPointSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onPointSelect?: (level: SusceptibilityLevel) => void
  /** OSM infrastructure points for the categories currently toggled on. */
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const { data, error } = useSWR<DeslizamientosResponse>("/api/deslizamientos", fetcher, {
    revalidateOnFocus: false,
  })
  const osmColors = useOsmCategoryColors()

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [showSoilMoisture, setShowSoilMoisture] = useState(false)

  useEffect(() => {
    const entries = SUSCEPTIBILITY_LEVELS.map(
      (level) => [level, resolveCssColor(levelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
  }, [])

  const colorForLevel = useCallback(
    (level: string | undefined) => (level && resolvedColors?.[level]) || "var(--muted-foreground)",
    [resolvedColors],
  )

  const points = useMemo(() => data?.points.features ?? [], [data])

  return (
    <div className={className ?? "relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showSoilMoisture && (
          <TileLayer
            attribution="NASA GIBS / SMAP"
            url={SMAP_TILE_URL}
            opacity={0.6}
            maxNativeZoom={6}
          />
        )}
        {resolvedColors &&
          points.map((feature, i) => {
            const [lon, lat] = feature.geometry.coordinates
            const nivel = feature.properties.IS_nivel as SusceptibilityLevel | undefined
            const color = colorForLevel(nivel)
            return (
              <CircleMarker
                key={i}
                center={[lat, lon]}
                radius={3}
                pathOptions={{ color, weight: 0, fillColor: color, fillOpacity: 0.75 }}
                eventHandlers={
                  onPointSelect && nivel ? { click: () => onPointSelect(nivel) } : undefined
                }
              >
                <Popup>
                  <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                    <strong>{feature.properties.municipio ?? "—"}</strong>
                    <span>Susceptibilidad: {nivel ?? "—"}</span>
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
              pathOptions={{
                color: "#fff",
                weight: 1,
                fillColor: osmColors[p.category],
                fillOpacity: 0.9,
              }}
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
      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <span className="text-sm text-destructive">No se pudo cargar la capa.</span>
        </div>
      )}
      <SoilMoistureControl checked={showSoilMoisture} onCheckedChange={setShowSoilMoisture} />
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      <Legend />
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through DeslizamientosLiveMapLoader (next/dynamic, ssr: false).
export default DeslizamientosLiveMapImpl
