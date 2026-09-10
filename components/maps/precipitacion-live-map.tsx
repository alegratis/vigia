"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  TileLayer,
  GeoJSON,
  Popup,
  WMSTileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet"
import { BasemapTileLayer } from "./basemap-tile-layer"
import type { Layer, LatLngBoundsExpression, LeafletMouseEvent, PathOptions, WMSParams } from "leaflet"
import "leaflet/dist/leaflet.css"
import { ExternalLink, Loader2 } from "lucide-react"
import useSWR from "swr"
import {
  PRECIPITATION_LEVELS,
  PRECIPITATION_LEVEL_STYLES,
  precipitationLevelColorToken,
} from "@/lib/precipitacion/levels"
import { IMERG_TILE_URL, IMERG_WORLDVIEW_URL } from "@/lib/precipitacion/imerg"
import { ACCUMULATION_WINDOW_OPTIONS, FORECAST_WINDOW_OPTIONS } from "@/lib/precipitacion/api-types"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { normalizeMunicipioName } from "@/lib/demografia/categories"
import { getOsmCategory } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { OsmLegend } from "@/components/maps/osm-legend"
import { VeredasOverlay } from "@/components/maps/veredas-overlay"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { WmsLegendChip } from "@/components/maps/wms-legend-chip"
import { GWIS_WMS_URL } from "@/lib/incendios/gwis"
import {
  GWIS_SETTLEMENT_LAYER,
  GWIS_SETTLEMENT_LEGEND_URL,
  GWIS_PROTECTED_AREAS_LAYER,
  GWIS_PROTECTED_AREAS_LEGEND_URL,
} from "@/lib/demografia/gwis-context-layers"
import type { PrecipitacionAmenazaResponse, PrecipitacionFuente, PrecipitacionMode } from "@/lib/precipitacion/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

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

function ThreatLegend({ title }: { title: string }) {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(PRECIPITATION_LEVELS.map((level) => resolveCssColor(precipitationLevelColorToken(level))))
  }, [])

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">{title}</p>
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

function SettlementLegend() {
  return (
    <WmsLegendChip
      src={GWIS_SETTLEMENT_LEGEND_URL}
      alt="Leyenda de asentamientos humanos (GHSL Built-Up)"
    />
  )
}

function ProtectedAreasLegend() {
  return (
    <WmsLegendChip
      src={GWIS_PROTECTED_AREAS_LEGEND_URL}
      alt="Leyenda de áreas protegidas (WDPA)"
    />
  )
}

/**
 * Live precipitación map: renders each vereda colored by its rainfall
 * level, toggling between a backward-looking accumulation window (NASA
 * POWER, 7/14/30 días — see lib/precipitacion/server.ts, the only hazard
 * layer in this app with full coverage of Zarzal) and a forward-looking
 * forecast (Open-Meteo, 7/14 días — see lib/precipitacion/forecast-client.ts),
 * with an optional GPM IMERG satellite precipitation-rate raster overlay
 * (NASA GIBS, see lib/precipitacion/imerg.ts — the same live layer the
 * inundaciones map offers as rainfall context). Click a vereda for its
 * accumulation/forecast and level; the shared sidebar's population card
 * narrows down to the same vereda too, resolved by DIVIPOLA code against
 * the RED LabOT veredas layer (see lib/veredas/boundaries.ts) that this
 * map's own vereda polygons are already built from.
 */
function PrecipitacionLiveMapImpl({
  onBoundsChange,
  onZoneSelect,
  onVeredaSelect,
  onVeredaFeatureSelect,
  osmPoints,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  /** Bubbles a clicked vereda's identity up, so the panel below the map can show its rainfall-normal histogram. */
  onVeredaSelect?: (vereda: { codigoVereda: string; nombre: string; municipio: string }) => void
  /** Bubbles the clicked vereda's full population/hazard feature up to the shared sidebar card. */
  onVeredaFeatureSelect?: (feature: VeredaFeature | null) => void
  /** OSM infrastructure points for the categories currently toggled on. */
  osmPoints?: OsmPoint[]
  className?: string
}) {
  const [mode, setMode] = useState<PrecipitacionMode>("historico")
  const [windowDays, setWindowDays] = useState<number>(7)
  const [fuente, setFuente] = useState<PrecipitacionFuente>("power")

  const { data, error } = useSWR<PrecipitacionAmenazaResponse>(
    `/api/precipitacion/amenaza?mode=${mode}&window=${windowDays}&fuente=${fuente}`,
    fetcher,
    { revalidateOnFocus: false },
  )
  const osmColors = useOsmCategoryColors()
  // Always fetched (not gated behind the "Límites veredales" toggle below) since every
  // vereda click on this map's own primary layer needs to resolve a population figure
  // for the shared sidebar card, regardless of whether that boundary overlay is on.
  const { veredas: veredasPoblacion } = useVeredas(true)

  const [resolvedColors, setResolvedColors] = useState<Record<string, string> | null>(null)
  const [showImerg, setShowImerg] = useState(true)
  const [showVeredas, setShowVeredas] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showProtectedAreas, setShowProtectedAreas] = useState(false)

  const windowOptions = mode === "pronostico" ? FORECAST_WINDOW_OPTIONS : ACCUMULATION_WINDOW_OPTIONS

  const handleModeChange = useCallback(
    (nextMode: PrecipitacionMode) => {
      setMode(nextMode)
      const nextOptions = nextMode === "pronostico" ? FORECAST_WINDOW_OPTIONS : ACCUMULATION_WINDOW_OPTIONS
      if (!(nextOptions as readonly number[]).includes(windowDays)) {
        setWindowDays(7)
      }
    },
    [windowDays],
  )

  const fuenteLabel = fuente === "ideam" ? "IDEAM" : "NASA POWER"
  const windowLabel =
    mode === "pronostico" ? `Pronóstico ${windowDays} días` : `Lluvia acumulada (${windowDays} días) · ${fuenteLabel}`

  useEffect(() => {
    const entries = PRECIPITATION_LEVELS.map(
      (level) => [level, resolveCssColor(precipitationLevelColorToken(level))] as const,
    )
    setResolvedColors(Object.fromEntries(entries))
  }, [])

  const style = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.nivel as string | undefined
      const sinCobertura = feature?.properties?.sinCobertura as boolean | undefined
      const color = (level && resolvedColors?.[level]) || "var(--muted-foreground)"
      return {
        color,
        weight: 1,
        fillColor: color,
        // IDEAM veredas outside every station's radius get a visibly muted fill,
        // distinct from a normal "Bajo" level, so sparse coverage reads as "no data" not "low rain".
        fillOpacity: sinCobertura ? 0.08 : 0.5,
      }
    },
    [resolvedColors],
  )

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: Layer) => {
      const municipio = feature.properties?.municipio as string | undefined
      const vereda = feature.properties?.nombre as string | undefined
      const codigoVereda = feature.properties?.codigoVereda as string | undefined
      const nivel = feature.properties?.nivel as string | undefined
      const acumulado = feature.properties?.acumuladoMm as number | undefined
      const dias = feature.properties?.diasValidos as number | undefined
      const probabilidad = feature.properties?.probabilidadMax as number | undefined
      const sinCobertura = feature.properties?.sinCobertura as boolean | undefined
      const estacionNombre = feature.properties?.estacionNombre as string | undefined
      const distanciaEstacionKm = feature.properties?.distanciaEstacionKm as number | undefined
      const rowLabel = mode === "pronostico" ? `Pronóstico ${windowDays} días` : `Acumulado ${windowDays} días`
      layer.bindPopup(
        `<div style="font-size:13px;display:flex;flex-direction:column;gap:2px">
        <strong>${vereda ?? municipio ?? "—"}</strong>
        ${vereda ? `<span>${municipio ?? ""}</span>` : ""}
        ${
          sinCobertura
            ? `<span>Sin cobertura de estaciones IDEAM cercanas</span>`
            : `<span>Nivel: ${nivel ?? "—"}</span>
        <span>${rowLabel}: ${acumulado != null ? `${acumulado} mm` : "—"}${dias != null && dias < windowDays && mode !== "historico" ? ` (${dias} días con datos)` : ""}</span>
        ${probabilidad != null ? `<span>Probabilidad máxima: ${probabilidad}%</span>` : ""}
        ${estacionNombre ? `<span>Estación: ${estacionNombre} (${distanciaEstacionKm} km)</span>` : ""}`
        }
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
        if (codigoVereda && vereda && municipio) {
          onVeredaSelect?.({ codigoVereda, nombre: vereda, municipio })
          const feature = veredasPoblacion?.features.find(
            (f) => f.properties.codigoVereda === codigoVereda,
          )
          onVeredaFeatureSelect?.(feature ?? null)
        }
      })
    },
    [onZoneSelect, onVeredaSelect, onVeredaFeatureSelect, veredasPoblacion, mode, windowDays],
  )

  // Re-key the GeoJSON layer once colors resolve (so Leaflet re-applies `style` per feature) and
  // again once the population lookup loads: react-leaflet's GeoJSON only calls `onEachFeature`
  // once, at layer construction, so its closure would otherwise keep referencing `veredasPoblacion`
  // as it was at mount (near-certainly still null — that fetch takes several seconds) forever,
  // even though the callback prop itself is refreshed on every render.
  const geoJsonKey = useMemo(
    () => `${resolvedColors ? "resolved" : "pending"}-${veredasPoblacion ? "with-poblacion" : "no-poblacion"}`,
    [resolvedColors, veredasPoblacion],
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
        {showImerg && (
          <TileLayer attribution="NASA GIBS / IMERG" url={IMERG_TILE_URL} opacity={0.6} maxNativeZoom={6} />
        )}
        {showSettlement && (
          <WMSTileLayer
            url={GWIS_WMS_URL}
            opacity={0.7}
            params={
              {
                layers: GWIS_SETTLEMENT_LAYER,
                format: "image/png",
                transparent: true,
                version: "1.1.1",
              } as WMSParams
            }
          />
        )}
        {showProtectedAreas && (
          <WMSTileLayer
            url={GWIS_WMS_URL}
            opacity={0.6}
            params={
              {
                layers: GWIS_PROTECTED_AREAS_LAYER,
                format: "image/png",
                transparent: true,
                version: "1.1.1",
              } as WMSParams
            }
          />
        )}
        {data?.veredas && resolvedColors && (
          <GeoJSON
            key={geoJsonKey}
            data={data.veredas as unknown as GeoJSON.GeoJsonObject}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
        <VeredasOverlay enabled={showVeredas} onSelect={onVeredaFeatureSelect} />
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

      <div className="absolute left-3 top-3 z-[400] flex flex-col gap-2 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur">
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Modo de datos">
            <button
              type="button"
              onClick={() => handleModeChange("historico")}
              aria-pressed={mode === "historico"}
              className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                mode === "historico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Histórico
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("pronostico")}
              aria-pressed={mode === "pronostico"}
              className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                mode === "pronostico" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pronóstico
            </button>
          </div>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            aria-label="Ventana de días"
            className="rounded-sm border border-border bg-card px-1.5 py-1 font-medium text-foreground"
          >
            {windowOptions.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </div>
        {mode === "historico" && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-muted-foreground">Fuente:</span>
            <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Fuente de datos históricos">
              <button
                type="button"
                onClick={() => setFuente("power")}
                aria-pressed={fuente === "power"}
                className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                  fuente === "power" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                NASA POWER
              </button>
              <button
                type="button"
                onClick={() => setFuente("ideam")}
                aria-pressed={fuente === "ideam"}
                className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                  fuente === "ideam" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                IDEAM (estaciones)
              </button>
            </div>
          </div>
        )}
        {mode === "historico" && fuente === "ideam" && (
          <p className="max-w-[220px] text-[11px] leading-snug text-muted-foreground">
            Datos de estación en tiempo real, más precisos donde hay cobertura, pero solo cerca de Zarzal y
            Bugalagrande. Las veredas atenuadas no tienen estación cercana.
          </p>
        )}
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
        <div className="border-t border-border pt-1.5">
          <label className="flex items-center gap-1.5 font-medium text-foreground">
            <input
              type="checkbox"
              checked={showSettlement}
              onChange={(e) => setShowSettlement(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Asentamientos humanos (GHSL)
          </label>
        </div>
        <div className="border-t border-border pt-1.5">
          <label className="flex items-center gap-1.5 font-medium text-foreground">
            <input
              type="checkbox"
              checked={showProtectedAreas}
              onChange={(e) => setShowProtectedAreas(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Áreas protegidas (WDPA)
          </label>
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
      <ThreatLegend title={windowLabel} />
      <div className="absolute right-3 top-16 z-[400] max-w-[200px]">
        <OsmLegend points={osmPoints ?? []} />
      </div>
      {(showSettlement || showProtectedAreas) && (
        <div className="absolute bottom-3 right-3 z-[400] flex flex-col items-end gap-2">
          {showSettlement && <SettlementLegend />}
          {showProtectedAreas && <ProtectedAreasLegend />}
        </div>
      )}
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through PrecipitacionLiveMapLoader (next/dynamic, ssr: false).
export default PrecipitacionLiveMapImpl
