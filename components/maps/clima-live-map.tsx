"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import { BasemapTileLayer } from "./basemap-tile-layer"
import type { Layer, LatLngBoundsExpression, LeafletMouseEvent, PathOptions } from "leaflet"
import "leaflet/dist/leaflet.css"
import { Loader2 } from "lucide-react"
import useSWR from "swr"
import {
  TEMP_LEVELS,
  tempLevelColorToken,
  type ClimaForecastResponse,
  type ClimaVeredaProperties,
} from "@/lib/clima/api-types"
import { WEATHER_GROUP_LABELS } from "@/lib/clima/weather-codes"
import { weatherGlyphSvg } from "@/lib/clima/weather-glyph"
import { FIRE_THREAT_LEVELS, fireLevelColorToken } from "@/lib/incendios/levels"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { normalizeMunicipioName } from "@/lib/demografia/categories"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { VeredasOverlay } from "@/components/maps/veredas-overlay"
import { MunicipioTogglePanel, type MunicipioRiskSummary } from "@/components/maps/municipio-toggle-panel"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useMunicipioToggles, isMunicipioActive } from "@/lib/veredas/municipio-toggles"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

/** Which choropleth the vereda fill encodes. */
type ClimaCapa = "temperatura" | "incendio"

// Fallback center if bounds-fitting is unavailable — the midpoint of AOI_BOUNDS below.
const AOI_CENTER: [number, number] = [4.24, -76.0]

/** Frames all three municipios — matches the precipitación map, the only other layer with full Zarzal coverage. */
const AOI_BOUNDS: LatLngBoundsExpression = [
  [3.88, -76.15],
  [4.44, -75.72],
]

const fetcher = async (url: string): Promise<ClimaForecastResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de clima")
  return res.json()
}

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

function ClimaLegend({ capa, tempColors, fireColors }: {
  capa: ClimaCapa
  tempColors: Record<string, string> | null
  fireColors: Record<string, string> | null
}) {
  const rows =
    capa === "temperatura"
      ? TEMP_LEVELS.map((level) => ({ label: level, color: tempColors?.[level] }))
      : FIRE_THREAT_LEVELS.map((level) => ({ label: level, color: fireColors?.[level] }))

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">
        {capa === "temperatura" ? "Temperatura actual" : "Vulnerabilidad a incendio"}
      </p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color ?? "transparent" }}
              aria-hidden="true"
            />
            {row.label}
          </li>
        ))}
      </ul>
      {capa === "incendio" && (
        <p className="mt-1.5 max-w-[190px] text-[11px] leading-snug text-muted-foreground">
          Amenaza estructural ajustada por la racha seca prevista. Zarzal queda sin dato.
        </p>
      )}
    </div>
  )
}

/**
 * Live clima map: a conventional weather report for the study area. Each
 * vereda is filled either by its current temperature band or by a
 * dry-spell-adjusted fire vulnerability (a derived figure — see
 * lib/clima/fire-adjustment.ts), toggled by the layer switch. One prominent
 * marker per municipality shows its cabecera's current conditions
 * (temperature + weather glyph); clicking any vereda opens its full 7-day
 * report in the card below the map and narrows the shared sidebar's
 * population figures to that vereda. All data comes from Open-Meteo
 * (lib/clima/weather-client.ts).
 */
function ClimaLiveMapImpl({
  onBoundsChange,
  onZoneSelect,
  onVeredaFeatureSelect,
  onClimaSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  /** Bubbles the clicked vereda's full population/hazard feature up to the shared sidebar card. */
  onVeredaFeatureSelect?: (feature: VeredaFeature | null) => void
  /** Bubbles the clicked vereda's clima properties up so the report card below the map can render its forecast. */
  onClimaSelect?: (properties: ClimaVeredaProperties | null) => void
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const [capa, setCapa] = useState<ClimaCapa>("temperatura")
  const [showVeredas, setShowVeredas] = useState(false)

  const { data, error } = useSWR<ClimaForecastResponse>("/api/clima/forecast", fetcher, {
    revalidateOnFocus: false,
  })
  const osmColors = useOsmCategoryColors()
  const { veredas: veredasPoblacion } = useVeredas(true)
  const { active: activeMunicipiosMap, activeMunicipios, toggle: toggleMunicipio } = useMunicipioToggles()

  const [tempColors, setTempColors] = useState<Record<string, string> | null>(null)
  const [fireColors, setFireColors] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    setTempColors(Object.fromEntries(TEMP_LEVELS.map((l) => [l, resolveCssColor(tempLevelColorToken(l))])))
    setFireColors(Object.fromEntries(FIRE_THREAT_LEVELS.map((l) => [l, resolveCssColor(fireLevelColorToken(l))])))
  }, [])

  const colorsReady = tempColors && fireColors

  const municipioSummaries = useMemo<MunicipioRiskSummary[]>(() => {
    if (!data?.veredas) return []
    const byMunicipio = new Map<string, Record<string, number>>()
    for (const feature of data.veredas.features) {
      const rawMunicipio = feature.properties?.municipio
      const key =
        capa === "temperatura" ? feature.properties?.nivelTemp : feature.properties?.amenazaIncendioAjustada
      if (!rawMunicipio || !key) continue
      const municipio = normalizeMunicipioName(rawMunicipio)
      const counts = byMunicipio.get(municipio) ?? {}
      counts[key] = (counts[key] ?? 0) + 1
      byMunicipio.set(municipio, counts)
    }
    const order = capa === "temperatura" ? (TEMP_LEVELS as readonly string[]) : (FIRE_THREAT_LEVELS as readonly string[])
    const colorFor = (level: string) => (capa === "temperatura" ? tempLevelColorToken(level) : fireLevelColorToken(level))
    return Array.from(byMunicipio.entries()).map(([municipio, counts]) => ({
      municipio,
      items: order
        .filter((level) => (counts[level] ?? 0) > 0)
        .map((level) => ({ label: level, value: `${counts[level]}`, colorToken: colorFor(level) })),
    }))
  }, [data, capa])

  const municipioMarkers = useMemo(() => {
    if (!data?.municipios) return []
    return data.municipios.map((m) => {
      const glyph = weatherGlyphSvg(m.grupoActual ?? "nublado", { size: 18, esDia: m.esDia })
      const temp = m.tempActual != null ? `${Math.round(m.tempActual)}°` : "—"
      const range =
        m.tempMax != null && m.tempMin != null
          ? `<span style="font-size:10px;font-weight:500;opacity:0.75">${Math.round(m.tempMax)}° / ${Math.round(m.tempMin)}°</span>`
          : ""
      const icon = L.divIcon({
        className: "",
        iconSize: [1, 1],
        iconAnchor: [0, 0],
        html: `<div style="transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;white-space:nowrap">
          <div style="display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:9999px;background:var(--card);color:var(--foreground);border:1px solid var(--border);box-shadow:0 1px 4px rgba(0,0,0,0.3);font-size:14px;font-weight:700;line-height:1">
            ${glyph}<span>${temp}</span>${range}
          </div>
          <span style="font-size:11px;font-weight:700;color:var(--foreground);text-shadow:0 1px 3px var(--background),0 0 3px var(--background)">${m.municipio}</span>
        </div>`,
      })
      return { municipio: m.municipio, lat: m.lat, lon: m.lon, icon }
    })
  }, [data])

  const style = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const props = feature?.properties as ClimaVeredaProperties | undefined
      const municipio = props?.municipio
      const active = municipio ? isMunicipioActive(municipio, activeMunicipios) : true
      if (!active) {
        return { color: "var(--muted-foreground)", weight: 1, opacity: 0.3, fillColor: "var(--muted-foreground)", fillOpacity: 0.06 }
      }
      if (capa === "temperatura") {
        const color = (props?.nivelTemp && tempColors?.[props.nivelTemp]) || "var(--muted-foreground)"
        return { color, weight: 1, fillColor: color, fillOpacity: props?.nivelTemp ? 0.55 : 0.08 }
      }
      const level = props?.amenazaIncendioAjustada
      const color = (level && fireColors?.[level]) || "var(--muted-foreground)"
      // Veredas with no base fire label (Zarzal) read as no-data, not "low".
      return { color, weight: 1, fillColor: color, fillOpacity: level ? 0.55 : 0.06 }
    },
    [capa, tempColors, fireColors, activeMunicipios],
  )

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: Layer) => {
      const props = feature.properties as ClimaVeredaProperties | undefined
      if (!props) return
      const glyph = props.grupoActual ? weatherGlyphSvg(props.grupoActual, { size: 16, esDia: props.esDia }) : ""
      const condicion = props.grupoActual ? WEATHER_GROUP_LABELS[props.grupoActual] : "Sin dato"
      const tempActual = props.tempActual != null ? `${Math.round(props.tempActual)}°C` : "—"
      const sensacionRow =
        props.sensacionTermica != null
          ? `<span>Sensación térmica: ${Math.round(props.sensacionTermica)}°C</span>`
          : ""
      const rango =
        props.tempMaxHoy != null && props.tempMinHoy != null
          ? `${Math.round(props.tempMaxHoy)}° / ${Math.round(props.tempMinHoy)}°`
          : "—"
      const fireBase = props.amenazaIncendioBase
      const fireAdj = props.amenazaIncendioAjustada
      const fireRow = fireAdj
        ? `<span>Vulnerabilidad a incendio: ${fireAdj}${props.incendioElevado ? ` (elevada por sequía, base ${fireBase})` : ""}</span>`
        : `<span>Vulnerabilidad a incendio: sin dato</span>`

      layer.bindTooltip(
        `<span style="font-weight:600">${props.nombre}</span> · ${tempActual}`,
        { direction: "top", opacity: 0.95 },
      )
      layer.bindPopup(
        `<div style="font-size:13px;display:flex;flex-direction:column;gap:3px;min-width:170px">
          <strong>${props.nombre}</strong>
          <span>${props.municipio}</span>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
            ${glyph}<span style="font-size:18px;font-weight:700">${tempActual}</span>
          </div>
          <span>${condicion}</span>
          ${sensacionRow}
          <span>Hoy: ${rango}</span>
          <span>Racha seca prevista: ${props.rachaSeca} día${props.rachaSeca === 1 ? "" : "s"}</span>
          ${fireRow}
        </div>`,
      )

      const active = props.municipio ? isMunicipioActive(props.municipio, activeMunicipios) : true
      if (active) {
        layer.on("mouseover", (e: LeafletMouseEvent) => {
          ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.8 })
        })
        layer.on("mouseout", (e: LeafletMouseEvent) => {
          ;(e.target as Layer & { setStyle: (s: PathOptions) => void }).setStyle({ fillOpacity: 0.55 })
        })
      }
      layer.on("click", () => {
        if (props.municipio) onZoneSelect?.(normalizeMunicipioName(props.municipio))
        onClimaSelect?.(props)
        const populationFeature = veredasPoblacion?.features.find(
          (f) => f.properties.codigoVereda === props.codigoVereda,
        )
        onVeredaFeatureSelect?.(populationFeature ?? null)
      })
    },
    [onZoneSelect, onClimaSelect, onVeredaFeatureSelect, veredasPoblacion, activeMunicipios],
  )

  // Re-key so Leaflet re-runs `style`/`onEachFeature` when colors resolve, the
  // population lookup loads, the active municipalities change, or the layer
  // switches — react-leaflet's GeoJSON only wires those up at construction.
  const geoJsonKey = useMemo(
    () =>
      `${colorsReady ? "resolved" : "pending"}-${veredasPoblacion ? "pob" : "nopob"}-${capa}-${activeMunicipios.join(",")}`,
    [colorsReady, veredasPoblacion, capa, activeMunicipios],
  )

  return (
    <div className={className ?? "relative isolate h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border"}>
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
        <BasemapTileLayer />
        {data?.veredas && colorsReady && (
          <GeoJSON
            key={geoJsonKey}
            data={data.veredas as unknown as GeoJSON.GeoJsonObject}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
        <VeredasOverlay enabled={showVeredas} onSelect={onVeredaFeatureSelect} activeMunicipios={activeMunicipios} />
        {municipioMarkers.map((m) => (
          <Marker key={m.municipio} position={[m.lat, m.lon]} icon={m.icon} interactive={false} keyboard={false} />
        ))}
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

      <div className="absolute left-3 top-3 z-[400] flex flex-col gap-2 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur">
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Capa del mapa">
          <button
            type="button"
            onClick={() => setCapa("temperatura")}
            aria-pressed={capa === "temperatura"}
            className={`rounded-sm px-2 py-1 font-medium transition-colors ${
              capa === "temperatura" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Temperatura
          </button>
          <button
            type="button"
            onClick={() => setCapa("incendio")}
            aria-pressed={capa === "incendio"}
            className={`rounded-sm px-2 py-1 font-medium transition-colors ${
              capa === "incendio" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Vulnerabilidad a incendio
          </button>
        </div>
        <div className="border-t border-border pt-1.5">
          <label className="flex items-center gap-1.5 font-medium text-foreground">
            <input
              type="checkbox"
              checked={showVeredas}
              onChange={(e) => setShowVeredas(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Límites veredales
          </label>
          {showVeredas && (
            <p className="pl-5 pt-1 text-[11px] leading-snug text-muted-foreground">
              Muestra el resumen de población e infraestructura de cada vereda.
            </p>
          )}
        </div>
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
      <ClimaLegend capa={capa} tempColors={tempColors} fireColors={fireColors} />
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      <MunicipioTogglePanel
        active={activeMunicipiosMap}
        onToggle={toggleMunicipio}
        summaries={municipioSummaries}
        riskTitle={capa === "temperatura" ? "Temperatura (veredas por banda)" : "Incendio (veredas por nivel)"}
      />
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through ClimaLiveMapLoader (next/dynamic, ssr: false).
export default ClimaLiveMapImpl
