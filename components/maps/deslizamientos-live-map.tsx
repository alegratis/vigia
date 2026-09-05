"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, GeoJSON, Popup, useMap, useMapEvents } from "react-leaflet"
import type { Layer, LeafletMouseEvent, PathOptions } from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2 } from "lucide-react"
import useSWR from "swr"
import {
  SUSCEPTIBILITY_LEVELS,
  SUSCEPTIBILITY_LEVEL_STYLES,
  levelColorToken,
} from "@/lib/deslizamientos/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import type { DeslizamientosResponse } from "@/lib/deslizamientos/api-types"
import type { MapBounds } from "@/lib/map-bounds"

const AOI_CENTER: [number, number] = [4.42, -75.86]

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

/**
 * Live landslide susceptibility map: renders the public
 * `amenaza_por_deslizamiento` polygons published on ArcGIS Online directly
 * over OpenStreetMap. Click a zone for its municipality and threat level.
 */
function DeslizamientosLiveMapImpl({
  onBoundsChange,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
}) {
  const { data, error } = useSWR<DeslizamientosResponse>("/api/deslizamientos", fetcher, {
    revalidateOnFocus: false,
  })

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    const entries = SUSCEPTIBILITY_LEVELS.map(
      (level) => [level, resolveCssColor(levelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
  }, [])

  const style = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.IS_nivel as string | undefined
      const color = (level && resolvedColors?.[level]) || "var(--muted-foreground)"
      return {
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.55,
      }
    },
    [resolvedColors],
  )

  const onEachFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const municipio = feature.properties?.municipio as string | undefined
    const nivel = feature.properties?.IS_nivel as string | undefined
    layer.bindPopup(
      `<div style="font-size:13px;display:flex;flex-direction:column;gap:2px">
        <strong>${municipio ?? "—"}</strong>
        <span>Susceptibilidad: ${nivel ?? "—"}</span>
      </div>`,
    )
    layer.on("mouseover", (e: LeafletMouseEvent) => {
      ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.75 })
    })
    layer.on("mouseout", (e: LeafletMouseEvent) => {
      ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.55 })
    })
  }, [])

  // Re-key the GeoJSON layer once colors resolve so Leaflet re-applies `style` per feature.
  const geoJsonKey = useMemo(
    () => (resolvedColors ? "resolved" : "pending"),
    [resolvedColors],
  )

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border">
      <MapContainer center={AOI_CENTER} zoom={12} minZoom={9} maxZoom={16} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {data?.polygons && resolvedColors && (
          <GeoJSON
            key={geoJsonKey}
            data={data.polygons as unknown as GeoJSON.GeoJsonObject}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
        {onBoundsChange && <BoundsSync onBoundsChange={onBoundsChange} />}
      </MapContainer>
      {!data && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      {error && (
        <Popup position={AOI_CENTER}>
          <span className="text-sm text-destructive">No se pudo cargar la capa.</span>
        </Popup>
      )}
      <Legend />
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through DeslizamientosLiveMapLoader (next/dynamic, ssr: false).
export default DeslizamientosLiveMapImpl
