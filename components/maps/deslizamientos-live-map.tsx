"use client"

import { useCallback, useEffect, useState } from "react"
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
import { SUSCEPTIBILITY_LEVELS, SUSCEPTIBILITY_LEVEL_STYLES, levelColorToken } from "@/lib/deslizamientos/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { SMAP_TILE_URL, SMAP_WORLDVIEW_URL } from "@/lib/deslizamientos/smap"
import { BasemapTileLayer } from "@/components/maps/basemap-tile-layer"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { useCriticalSites } from "@/lib/deslizamientos/use-critical-sites"
import {
  CRITICAL_SITE_SEVERITY_STYLES,
  severityColorToken,
  tipoLabel,
} from "@/lib/deslizamientos/critical-sites-types"
import { VeredasOverlay } from "@/components/maps/veredas-overlay"
import { useVeredas } from "@/lib/veredas/use-veredas"
import type { VeredaFeature } from "@/lib/veredas/api-types"
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

interface MapLayersControlProps {
  showSoilMoisture: boolean
  onSoilMoistureChange: (checked: boolean) => void
  showCriticalSites: boolean
  onCriticalSitesChange: (checked: boolean) => void
}

/**
 * Toggle panel for this map's optional overlays: SMAP root-zone soil
 * moisture (a satellite proxy for the antecedent-moisture signal this
 * map's own rainfall trigger already estimates from ground-station-
 * informed rainfall — worth cross-checking against, not a duplicate) and
 * "Sitios críticos" (field-surveyed road-damage points from the Valle del
 * Cauca infrastructure secretariat — see lib/deslizamientos/critical-sites.ts).
 * No legend is fabricated for soil moisture — GIBS doesn't publish one for
 * this layer, so its caption links to NASA Worldview's own color scale
 * instead.
 */
function MapLayersControl({
  showSoilMoisture,
  onSoilMoistureChange,
  showCriticalSites,
  onCriticalSitesChange,
}: MapLayersControlProps) {
  return (
    <div className="absolute left-3 top-3 z-[400] flex flex-col gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showSoilMoisture}
            onChange={(e) => onSoilMoistureChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Humedad del suelo (SMAP)
        </label>
        {showSoilMoisture && (
          <a
            href={SMAP_WORLDVIEW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 pl-5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver escala en Worldview
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </div>
      <div className="border-t border-border pt-1.5">
        <label className="flex items-center gap-2 font-medium text-foreground">
          <input
            type="checkbox"
            checked={showCriticalSites}
            onChange={(e) => onCriticalSitesChange(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Sitios críticos (2019)
        </label>
      </div>
    </div>
  )
}

/**
 * Legend for the "Sitios críticos" overlay's severity scale
 * (`SEVERIDAD`, 1–4), shown only while the layer is toggled on.
 */
function CriticalSitesLegend() {
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Sitios críticos — severidad</p>
      <ul className="flex flex-col gap-1">
        {Object.values(CRITICAL_SITE_SEVERITY_STYLES).map((style) => (
          <li key={style.code} className="flex items-center gap-2 text-muted-foreground">
            <span
              className={`size-2.5 shrink-0 rounded-full ${style.swatchClass}`}
              aria-hidden="true"
            />
            {style.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Live landslide hazard map: shades each vereda (~55 across Sevilla,
 * Caicedonia and Zarzal) by this app's own hazard model — slope + road
 * proximity + a rainfall-anomaly trigger, computed at its centroid (see
 * lib/deslizamientos/hazard-model.ts) — rather than RED LabOT's discontinued
 * `VIGIA_Amenaza_IS_Puntos` point grid, which only ever covered Sevilla and
 * Caicedonia. Optionally overlaid with NASA GIBS's SMAP root-zone soil
 * moisture. Click a vereda for its hazard level and the model's underlying
 * factors.
 */
function DeslizamientosLiveMapImpl({
  onBoundsChange,
  onVeredaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  /** Bubbles up the vereda clicked on the map, so a panel below can drill into its own hazard-model factors. */
  onVeredaSelect?: (feature: VeredaFeature) => void
  /** OSM infrastructure points for the categories currently toggled on. */
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const osmColors = useOsmCategoryColors()
  // Always enabled now that vereda shading is this map's primary layer, not
  // an opt-in overlay — VeredasOverlay's own useVeredas(true) call below
  // dedupes against this same SWR key, so this doesn't add a second request.
  const { error: veredasError, isLoading: veredasLoading } = useVeredas(true)

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [showSoilMoisture, setShowSoilMoisture] = useState(false)
  const [showCriticalSites, setShowCriticalSites] = useState(false)
  const { points: criticalSites } = useCriticalSites(showCriticalSites)

  useEffect(() => {
    const entries = SUSCEPTIBILITY_LEVELS.map(
      (level) => [level, resolveCssColor(levelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  const colorForLevel = useCallback(
    (level: string | undefined) => (level && resolvedColors?.[level]) || "var(--muted-foreground)",
    [resolvedColors],
  )

  const veredaColor = useCallback(
    (feature: VeredaFeature) => {
      const level = feature.properties.dominantLevel
      return level ? colorForLevel(level) : noDataColor ?? "var(--muted-foreground)"
    },
    [colorForLevel, noDataColor],
  )

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
        <BasemapTileLayer />
        {showSoilMoisture && (
          <TileLayer
            attribution="NASA GIBS / SMAP"
            url={SMAP_TILE_URL}
            opacity={0.6}
            maxNativeZoom={6}
          />
        )}
        {resolvedColors && noDataColor && (
          <VeredasOverlay enabled colorForFeature={veredaColor} onSelect={onVeredaSelect} />
        )}
        {showCriticalSites &&
          criticalSites?.map((site) => (
            <CircleMarker
              key={site.id}
              center={[site.lat, site.lon]}
              radius={5}
              pathOptions={{
                color: "#fff",
                weight: 1,
                fillColor: severityColorToken(site.severidad),
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong>{tipoLabel(site.tipo)}</strong>
                  <span>{site.municipio}</span>
                  <span>{CRITICAL_SITE_SEVERITY_STYLES[site.severidad as 1 | 2 | 3 | 4]?.label ?? "—"}</span>
                  {site.observaciones && <span>{site.observaciones}</span>}
                  {site.fecha && <span style={{ color: "#888" }}>Registrado: {site.fecha}</span>}
                </div>
              </Popup>
            </CircleMarker>
          ))}
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
      <MapLayersControl
        showSoilMoisture={showSoilMoisture}
        onSoilMoistureChange={setShowSoilMoisture}
        showCriticalSites={showCriticalSites}
        onCriticalSitesChange={setShowCriticalSites}
      />
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      <Legend />
      {showCriticalSites && <CriticalSitesLegend />}
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through DeslizamientosLiveMapLoader (next/dynamic, ssr: false).
export default DeslizamientosLiveMapImpl
