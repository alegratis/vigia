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
import { MunicipioTogglePanel, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles } from "@/lib/veredas/municipio-toggles"
import { summarizeExposureByMunicipio } from "@/lib/veredas/municipio-summary"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { getOsmCategory } from "@/lib/osm/categories"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { useSismologiaDanos, useSismologiaEventos } from "@/lib/sismologia/use-sismologia"
import {
  SEISMIC_MAGNITUDE_LEVELS,
  SEISMIC_MAGNITUDE_LEVEL_STYLES,
  SEISMIC_EXPOSURE_LEVELS,
  SEISMIC_EXPOSURE_LEVEL_TOKENS,
  type SeismicExposureLevel,
  magnitudeLevel,
  magnitudeRadius,
  seismicExposureLevel,
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

const SOURCE_LABEL: Record<SeismicEvent["source"], string> = {
  "sgc-live": "SGC RSNC (en vivo)",
  usgs: "USGS (en vivo)",
  sgc: "SGC (histórico)",
}

/** Distinct marker styling per source: SGC live solid (primary), USGS hollow ring, SGC historical dashed. */
function SOURCE_STYLE(source: SeismicEvent["source"], color: string) {
  switch (source) {
    case "sgc-live":
      return { color: "#fff", weight: 1, fillColor: color, fillOpacity: 0.85 }
    case "usgs":
      return { color, weight: 2, fillColor: color, fillOpacity: 0.35 }
    case "sgc":
      return { color, weight: 2, fillColor: color, fillOpacity: 0.15, dashArray: "2 3" }
  }
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
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
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

/**
 * Legend for the per-vereda seismic exposure choropleth — the 0–1
 * distance-decay score (lib/sismologia/exposure-score.ts) binned onto the
 * shared 5-tier scale and colored with the sismología ramp. Sits just above
 * the magnitude legend so the two read as one stacked key.
 */
function ExposureLegend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(SEISMIC_EXPOSURE_LEVELS.map((level) => resolveCssColor(SEISMIC_EXPOSURE_LEVEL_TOKENS[level])))
  }, [])

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Exposición sísmica por vereda</p>
      <ul className="flex flex-col gap-1">
        {SEISMIC_EXPOSURE_LEVELS.map((level, i) => (
          <li key={level} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-sm"
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
 * Live seismic-activity map with three independently-toggleable, distinctly
 * styled sources: SGC's near-real-time RSNC feed (last 5 días) as the
 * primary live layer — solid filled markers, dense enough to show the small
 * local tremors USGS misses — USGS's FDSN feed (last 90 días) as a hollow
 * confirmation ring, and SGC's historical catalog as a dashed outline. Also
 * offers an optional Sevilla-only community damage-report summary (Survey123,
 * never showing individual points or victim counts — see
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
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()
  // Fetched to drive the municipality highlight + risk panel; the shared SWR
  // key dedupes against VeredasOverlay's own fetch below.
  const { veredas } = useVeredas(true)

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!veredas) return []
    return summarizeExposureByMunicipio(veredas).map((s) => ({
      municipio: s.municipio,
      items: [
        { label: "Población", value: s.poblacion != null ? Math.round(s.poblacion).toLocaleString("es-CO") : "—" },
        { label: "Escuelas", value: s.escuelas != null ? `${s.escuelas}` : "—" },
        { label: "Hospitales", value: s.hospitales != null ? `${s.hospitales}` : "—" },
        {
          label: "Infra. crítica",
          value: s.infraestructuraCritica != null ? `${s.infraestructuraCritica}` : "—",
        },
        { label: "Sitios críticos", value: `${s.sitiosCriticos}` },
      ],
    }))
  }, [veredas])

  const [showSgcLive, setShowSgcLive] = useState(true)
  const [showUsgs, setShowUsgs] = useState(true)
  const [showSgc, setShowSgc] = useState(true)
  const [showDamage, setShowDamage] = useState(false)
  const [showVeredas, setShowVeredas] = useState(true)
  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [exposureColors, setExposureColors] = useState<Record<SeismicExposureLevel, string> | null>(null)
  const [noDataColor, setNoDataColor] = useState<string | null>(null)

  useEffect(() => {
    const entries = SEISMIC_MAGNITUDE_LEVELS.map(
      (level) => [level, resolveCssColor(SEISMIC_MAGNITUDE_LEVEL_STYLES[level].colorToken)] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
    setExposureColors(
      Object.fromEntries(
        SEISMIC_EXPOSURE_LEVELS.map((level) => [level, resolveCssColor(SEISMIC_EXPOSURE_LEVEL_TOKENS[level])] as const),
      ) as Record<SeismicExposureLevel, string>,
    )
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  // Shades each vereda by its 0–1 seismic exposure score (the same
  // distance-decay model that feeds the compound-risk map), mirroring how
  // the deslizamientos and inundaciones maps shade their veredas — so this
  // map's polygons carry hazard color instead of rendering as bare outlines.
  const veredaColor = useCallback(
    (feature: VeredaFeature) => {
      const score = feature.properties.seismicScoreAvg
      if (score == null || !exposureColors) return noDataColor ?? "var(--muted-foreground)"
      return exposureColors[seismicExposureLevel(score)]
    },
    [exposureColors, noDataColor],
  )

  const visibleEvents = useMemo(() => {
    if (!data) return []
    // Draw order = array order: historical (bottom), USGS, then SGC live on top.
    const list: SeismicEvent[] = []
    if (showSgc) list.push(...data.sgc.events)
    if (showUsgs) list.push(...data.usgs.events)
    if (showSgcLive) list.push(...data.sgcLive.events)
    return list
  }, [data, showSgcLive, showUsgs, showSgc])

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
        <VeredasOverlay
          enabled={showVeredas}
          colorForFeature={exposureColors && noDataColor ? veredaColor : undefined}
          hazardKind="sismologia"
          onSelect={onVeredaSelect}
          activeMunicipios={activeMunicipios}
        />
        {resolvedColors &&
          visibleEvents.map((event) => {
            const color = resolvedColors[magnitudeLevel(event.magnitude)]
            const style = SOURCE_STYLE(event.source, color)
            return (
              <CircleMarker
                key={event.id}
                center={[event.lat, event.lon]}
                radius={magnitudeRadius(event.magnitude)}
                pathOptions={style}
              >
                <Popup>
                  <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                    <strong>M {event.magnitude.toFixed(1)}</strong>
                    <span>{event.place ?? "Catálogo histórico SGC"}</span>
                    <span>{formatDateTime(event.time)}</span>
                    {event.depthKm != null && <span>Profundidad: {event.depthKm.toFixed(1)} km</span>}
                    <span>Fuente: {SOURCE_LABEL[event.source]}</span>
                    {event.source === "sgc-live" && event.reviewStatus && (
                      <span>Revisión: {event.reviewStatus === "manual" ? "manual (analista)" : "automática"}</span>
                    )}
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
          <input type="checkbox" checked={showSgcLive} onChange={(e) => setShowSgcLive(e.target.checked)} className="size-3.5 accent-primary" />
          SGC en vivo (5 días)
        </label>
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

      <div className="absolute bottom-3 left-3 z-[400] flex flex-col gap-2">
        {showVeredas && <ExposureLegend />}
        <MagnitudeLegend />
      </div>
      <MunicipioTogglePanel
        active={activeMunicipiosMap}
        onToggle={toggleMunicipio}
        summaries={municipioSummaries}
        riskTitle="Exposición por municipio"
      />
      {showDamage && <DamageReportsPanel />}
    </div>
  )
}

export default SismologiaLiveMapImpl
