"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  TileLayer,
  GeoJSON,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { Layer, LatLngBoundsExpression, LeafletMouseEvent, PathOptions } from "leaflet"
import "leaflet/dist/leaflet.css"
import { ExternalLink, Loader2 } from "lucide-react"
import useSWR from "swr"
import {
  PRECIPITATION_LEVELS,
  PRECIPITATION_LEVEL_STYLES,
  precipitationLevelColorToken,
} from "@/lib/precipitacion/levels"
import { IMERG_TILE_URL, IMERG_WORLDVIEW_URL } from "@/lib/precipitacion/imerg"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { normalizeMunicipioName } from "@/lib/demografia/categories"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import type { PrecipitacionAmenazaResponse } from "@/lib/precipitacion/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"

// Fallback center if bounds-fitting is unavailable — the midpoint of AOI_BOUNDS below.
const AOI_CENTER: [number, number] = [4.24, -76.0]

/** Frames all three municipios — the widest extent of any hazard map, since precipitación has full coverage including Zarzal. */
const AOI_BOUNDS: LatLngBoundsExpression = [
  [3.88, -76.15],
  [4.44, -75.72],
]

const fetcher = async (url: string): Promise<PrecipitacionAmenazaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de precipitación")
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

function ThreatLegend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(PRECIPITATION_LEVELS.map((level) => resolveCssColor(precipitationLevelColorToken(level))))
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Lluvia acumulada (7 días)</p>
      <ul className="flex flex-col gap-1">
        {PRECIPITATION_LEVELS.map((level, i) => (
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
 * Live precipitación map: renders each vereda colored by its 7-day
 * accumulated-rainfall level (NASA POWER, see lib/precipitacion/server.ts —
 * the only hazard layer in this app with full coverage of Zarzal), with an
 * optional GPM IMERG satellite precipitation-rate raster overlay (NASA
 * GIBS, see lib/precipitacion/imerg.ts — the same live layer the
 * inundaciones map offers as rainfall context). Click a vereda for its
 * accumulation and level.
 */
function PrecipitacionLiveMapImpl({
  onBoundsChange,
  onZoneSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  /** OSM infrastructure points for the categories currently toggled on. */
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const { data, error } = useSWR<PrecipitacionAmenazaResponse>("/api/precipitacion/amenaza", fetcher, {
    revalidateOnFocus: false,
  })
  const osmColors = useOsmCategoryColors()

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [showImerg, setShowImerg] = useState(true)

  useEffect(() => {
    const entries = PRECIPITATION_LEVELS.map(
      (level) => [level, resolveCssColor(precipitationLevelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
  }, [])

  const style = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.nivel as string | undefined
      const color = (level && resolvedColors?.[level]) || "var(--muted-foreground)"
      return {
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.5,
      }
    },
    [resolvedColors],
  )

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: Layer) => {
      const municipio = feature.properties?.municipio as string | undefined
      const vereda = feature.properties?.nombre as string | undefined
      const nivel = feature.properties?.nivel as string | undefined
      const acumulado = feature.properties?.acumuladoMm as number | undefined
      const dias = feature.properties?.diasValidos as number | undefined
      layer.bindPopup(
        `<div style="font-size:13px;display:flex;flex-direction:column;gap:2px">
        <strong>${vereda ?? municipio ?? "—"}</strong>
        ${vereda ? `<span>${municipio ?? ""}</span>` : ""}
        <span>Nivel: ${nivel ?? "—"}</span>
        <span>Acumulado 7 días: ${acumulado != null ? `${acumulado} mm` : "—"}${dias != null && dias < 7 ? ` (${dias} días con datos)` : ""}</span>
      </div>`,
      )
      layer.on("mouseover", (e: LeafletMouseEvent) => {
        ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.75 })
      })
      layer.on("mouseout", (e: LeafletMouseEvent) => {
        ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.5 })
      })
      layer.on("click", () => {
        if (municipio) onZoneSelect?.(normalizeMunicipioName(municipio))
      })
    },
    [onZoneSelect],
  )

  // Re-key the GeoJSON layer once colors resolve so Leaflet re-applies `style` per feature.
  const geoJsonKey = useMemo(() => (resolvedColors ? "resolved" : "pending"), [resolvedColors])

  return (
    <div className={className ?? "relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
      <MapContainer
        center={AOI_CENTER}
        zoom={10}
        minZoom={9}
        maxZoom={16}
        bounds={AOI_BOUNDS}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <ZoomControl position="topright" />
        <AttributionControl position="bottomright" prefix="Leaflet" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showImerg && (
          <TileLayer attribution="NASA GIBS / IMERG" url={IMERG_TILE_URL} opacity={0.6} maxNativeZoom={6} />
        )}
        {data?.veredas && resolvedColors && (
          <GeoJSON
            key={geoJsonKey}
            data={data.veredas as unknown as GeoJSON.GeoJsonObject}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
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

      <div className="absolute left-3 top-3 z-[400] flex flex-col gap-1.5 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur">
        <label className="flex items-center gap-1.5 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showImerg}
            onChange={(e) => setShowImerg(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Tasa de precipitación (IMERG)
        </label>
        {showImerg && (
          <a
            href={IMERG_WORLDVIEW_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-5 inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver escala en Worldview
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </div>

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
      <ThreatLegend />
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through PrecipitacionLiveMapLoader (next/dynamic, ssr: false).
export default PrecipitacionLiveMapImpl
