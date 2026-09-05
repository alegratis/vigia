"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup, useMap, useMapEvents } from "react-leaflet"
import type { LatLngBoundsExpression } from "leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2 } from "lucide-react"
import {
  AOI_BOUNDS,
  AOI_CENTER,
  buildExportUrl,
  identifyReach,
  returnPeriodColor,
  returnPeriodLabel,
  type LatLngBounds,
  type ReachInfo,
} from "@/lib/geoglows/live-map"
import { STATIONS } from "@/lib/geoglows/stations"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { formatFlow } from "@/lib/flood-ui"
import type { MapBounds } from "@/lib/map-bounds"

function toLatLngBounds(b: LatLngBounds): LatLngBoundsExpression {
  return [
    [b.south, b.west],
    [b.north, b.east],
  ]
}

const stationIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:#fff;border:2px solid #1e3a8a;box-shadow:0 0 0 2px rgba(0,0,0,0.25)"></span>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

interface OverlaySyncProps {
  onBoundsChange: (bounds: MapBounds) => void
  onOverlayChange: (bounds: LatLngBounds, width: number, height: number) => void
}

/** Tracks the map viewport and reports it both as an export overlay request and to the shared bounds contract. */
function OverlaySync({ onBoundsChange, onOverlayChange }: OverlaySyncProps) {
  const map = useMap()

  const sync = useCallback(() => {
    const b = map.getBounds()
    const size = map.getSize()
    const bounds: LatLngBounds = {
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    }
    onOverlayChange(bounds, size.x, size.y)
    onBoundsChange(bounds)
  }, [map, onBoundsChange, onOverlayChange])

  useEffect(() => {
    sync()
  }, [sync])

  useMapEvents({
    moveend: sync,
    zoomend: sync,
    resize: sync,
  })

  return null
}

function ReachClickLayer() {
  const map = useMap()
  const [popup, setPopup] = useState<{ lat: number; lon: number; loading: boolean; info: ReachInfo | null; error: string | null } | null>(
    null,
  )

  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng
      setPopup({ lat, lon: lng, loading: true, info: null, error: null })
      const b = map.getBounds()
      const size = map.getSize()
      try {
        const info = await identifyReach(
          lat,
          lng,
          { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
          size.x,
          size.y,
        )
        setPopup({ lat, lon: lng, loading: false, info, error: info ? null : "no-reach" })
      } catch {
        setPopup({ lat, lon: lng, loading: false, info: null, error: "network" })
      }
    },
  })

  if (!popup) return null

  return (
    <Popup position={[popup.lat, popup.lon]} eventHandlers={{ remove: () => setPopup(null) }}>
      <div className="flex min-w-48 flex-col gap-1.5 text-sm">
        {popup.loading && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Consultando GEOGLOWS…
          </span>
        )}
        {!popup.loading && popup.error === "no-reach" && (
          <span className="text-muted-foreground">Sin tramo de río en este punto.</span>
        )}
        {!popup.loading && popup.error === "network" && (
          <span className="text-destructive">No se pudo consultar el servicio.</span>
        )}
        {!popup.loading && popup.info && (
          <>
            <span className="flex items-center gap-2 font-semibold">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: returnPeriodColor(popup.info.returnPeriod) }}
                aria-hidden="true"
              />
              {returnPeriodLabel(popup.info.returnPeriod)}
            </span>
            {popup.info.meanFlowCms != null && (
              <span>Caudal medio: {formatFlow(popup.info.meanFlowCms)}</span>
            )}
            {popup.info.strahlerOrder != null && (
              <span className="text-muted-foreground">
                Orden de Strahler: {popup.info.strahlerOrder}
              </span>
            )}
            {popup.info.forecastTimestamp && (
              <span className="text-xs text-muted-foreground">
                Pronóstico: {popup.info.forecastTimestamp}
              </span>
            )}
            <span className="text-xs text-muted-foreground">Fuente: GEOGLOWS / Esri Living Atlas</span>
          </>
        )}
      </div>
    </Popup>
  )
}

function Legend() {
  const [colors, setColors] = useState<string[] | null>(null)
  const legend = [
    { value: 0, label: "Normal", token: "var(--chart-2)" },
    { value: 2, label: "Supera 2 años", token: "var(--chart-3)" },
    { value: 10, label: "Supera 10 años", token: "var(--chart-4)" },
    { value: 25, label: "Supera 25 años", token: "var(--chart-4)" },
    { value: 50, label: "Supera 50 años", token: "var(--chart-5)" },
  ]

  useEffect(() => {
    setColors(legend.map((l) => resolveCssColor(l.token)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Periodo de retorno</p>
      <ul className="flex flex-col gap-1">
        {legend.map((l, i) => (
          <li key={l.value} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors?.[i] ?? "transparent" }}
              aria-hidden="true"
            />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Live GEOGLOWS flood map: renders their published ArcGIS Living Atlas
 * "GlobalWaterModel_Medium" layer directly over OpenStreetMap, centered on
 * the study area. Click any reach for its live forecast attributes.
 */
function GeoglowsLiveMapImpl({ onBoundsChange }: { onBoundsChange?: (bounds: MapBounds) => void }) {
  const [overlay, setOverlay] = useState<{ bounds: LatLngBounds; width: number; height: number } | null>(
    null,
  )
  const containerRef = useRef<HTMLDivElement>(null)

  const handleOverlayChange = useCallback((bounds: LatLngBounds, width: number, height: number) => {
    setOverlay({ bounds, width, height })
  }, [])

  const overlayUrl = useMemo(() => {
    if (!overlay) return null
    return buildExportUrl(overlay.bounds, overlay.width, overlay.height)
  }, [overlay])

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-border sm:min-h-[420px]"
    >
      <MapContainer
        center={AOI_CENTER}
        zoom={11}
        minZoom={6}
        maxZoom={16}
        className="h-full w-full"
        bounds={toLatLngBounds(AOI_BOUNDS)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {overlayUrl && overlay && (
          <ImageOverlay url={overlayUrl} bounds={toLatLngBounds(overlay.bounds)} opacity={0.9} />
        )}
        {STATIONS.map((s) => (
          <Marker key={s.slug} position={[s.lat, s.lon]} icon={stationIcon}>
            <Popup>
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">{s.name}</span>
                <span className="text-muted-foreground">{s.municipality}</span>
                <a
                  href={`/inundaciones/${s.slug}`}
                  className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ver hidrograma completo →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
        <ReachClickLayer />
        {onBoundsChange && (
          <OverlaySync onBoundsChange={onBoundsChange} onOverlayChange={handleOverlayChange} />
        )}
      </MapContainer>
      <Legend />
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through GeoglowsLiveMapLoader (next/dynamic, ssr: false).
export default GeoglowsLiveMapImpl
