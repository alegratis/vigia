"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AttributionControl,
  CircleMarker,
  GeoJSON,
  ImageOverlay,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  WMSTileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet"
import type { Layer, LatLngBoundsExpression, LatLngExpression, PathOptions, WMSParams } from "leaflet"
import "leaflet/dist/leaflet.css"
import useSWR from "swr"
import { Download, Loader2, Mountain, Droplets, Flame, CloudRain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BasemapTileLayer } from "@/components/maps/basemap-tile-layer"
import {
  SUSCEPTIBILITY_LEVELS,
  levelColorToken,
  normalizeSusceptibilityLevel,
} from "@/lib/deslizamientos/levels"
import { FLOOD_SUSCEPTIBILITY_LEVELS, floodSusceptibilityColorToken } from "@/lib/inundaciones/levels"
import { FIRE_THREAT_LEVELS, fireLevelColorToken } from "@/lib/incendios/levels"
import { PRECIPITATION_LEVELS, precipitationLevelColorToken } from "@/lib/precipitacion/levels"
import { SMAP_TILE_URL } from "@/lib/deslizamientos/smap"
import { GWIS_FWI_LAYER, GWIS_WMS_URL } from "@/lib/incendios/gwis"
import { IMERG_TILE_URL } from "@/lib/precipitacion/imerg"
import { buildProxyExportUrl, type LatLngBounds as GeoglowsBounds } from "@/lib/geoglows/live-map"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { CONFIDENCE_STYLES, formatDateTime, formatDistance, formatFrp } from "@/lib/firms/ui"
import type { VeredaListEntry } from "@/lib/veredas/list-api-types"
import type { DeslizamientosResponse } from "@/lib/deslizamientos/api-types"
import type { InundacionesSusceptibilidadResponse } from "@/lib/inundaciones/api-types"
import type { IncendiosAmenazaResponse } from "@/lib/incendios/api-types"
import type { PrecipitacionAmenazaResponse } from "@/lib/precipitacion/api-types"
import type { FiresResponse } from "@/lib/firms/api-types"

type HazardKey = "deslizamientos" | "inundaciones" | "incendios" | "precipitacion"

const HAZARD_META: Record<HazardKey, { label: string; icon: typeof Mountain }> = {
  deslizamientos: { label: "Deslizamientos", icon: Mountain },
  inundaciones: { label: "Inundaciones", icon: Droplets },
  incendios: { label: "Incendios", icon: Flame },
  precipitacion: { label: "Precipitación", icon: CloudRain },
}

const deslizamientosFetcher = async (url: string): Promise<DeslizamientosResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de deslizamientos")
  return res.json()
}
const inundacionesFetcher = async (url: string): Promise<InundacionesSusceptibilidadResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de inundaciones")
  return res.json()
}
const incendiosFetcher = async (url: string): Promise<IncendiosAmenazaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de incendios")
  return res.json()
}
const precipitacionFetcher = async (url: string): Promise<PrecipitacionAmenazaResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar la capa de precipitación")
  return res.json()
}
const firesFetcher = async (url: string): Promise<FiresResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar los focos activos")
  return res.json()
}

/** Converts a vereda's GeoJSON `[lon, lat]` MultiPolygon rings to Leaflet's `[lat, lon]` order. */
function toLatLngRings(coordinates: number[][][][]): LatLngExpression[][][] {
  return coordinates.map((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => [lat, lon])))
}

/** Fits the map to the selected vereda's bbox whenever it changes. */
function FitToVereda({ vereda }: { vereda: VeredaListEntry }) {
  const map = useMap()
  useEffect(() => {
    const [south, west, north, east] = vereda.bbox
    const bounds: LatLngBoundsExpression = [
      [south, west],
      [north, east],
    ]
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, vereda])
  return null
}

/** Reports the current viewport in the shape GEOGLOWS' export proxy expects, refreshed on move/zoom. */
function useGeoglowsOverlay(enabled: boolean) {
  const map = useMap()
  const [overlay, setOverlay] = useState<{ bounds: GeoglowsBounds; width: number; height: number } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const sync = () => {
      const b = map.getBounds()
      const size = map.getSize()
      setOverlay({
        bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
        width: size.x,
        height: size.y,
      })
    }
    sync()
    map.on("moveend", sync)
    map.on("zoomend", sync)
    return () => {
      map.off("moveend", sync)
      map.off("zoomend", sync)
    }
  }, [map, enabled])

  return overlay
}

function GeoglowsOverlay() {
  const overlay = useGeoglowsOverlay(true)
  if (!overlay) return null
  const bounds: LatLngBoundsExpression = [
    [overlay.bounds.south, overlay.bounds.west],
    [overlay.bounds.north, overlay.bounds.east],
  ]
  return (
    <ImageOverlay
      url={buildProxyExportUrl(overlay.bounds, overlay.width, overlay.height)}
      bounds={bounds}
      opacity={0.9}
      crossOrigin="anonymous"
    />
  )
}

function HazardLegend({ hazardKeys }: { hazardKeys: HazardKey[] }) {
  const [colors, setColors] = useState<Record<string, string[]> | null>(null)

  useEffect(() => {
    setColors({
      deslizamientos: SUSCEPTIBILITY_LEVELS.map((l) => resolveCssColor(levelColorToken(l))),
      inundaciones: FLOOD_SUSCEPTIBILITY_LEVELS.map((l) => resolveCssColor(floodSusceptibilityColorToken(l))),
      incendios: FIRE_THREAT_LEVELS.map((l) => resolveCssColor(fireLevelColorToken(l))),
      precipitacion: PRECIPITATION_LEVELS.map((l) => resolveCssColor(precipitationLevelColorToken(l))),
    })
  }, [])

  if (hazardKeys.length === 0) return null

  const LEVELS: Record<HazardKey, readonly string[]> = {
    deslizamientos: SUSCEPTIBILITY_LEVELS,
    inundaciones: FLOOD_SUSCEPTIBILITY_LEVELS,
    incendios: FIRE_THREAT_LEVELS,
    precipitacion: PRECIPITATION_LEVELS,
  }
  const TITLES: Record<HazardKey, string> = {
    deslizamientos: "Susceptibilidad a deslizamiento",
    inundaciones: "Susceptibilidad a inundación",
    incendios: "Amenaza por incendios",
    precipitacion: "Lluvia acumulada (7 días)",
  }

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-col gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      {hazardKeys.map((key) => (
        <div key={key}>
          <p className="mb-1 font-medium text-foreground">{TITLES[key]}</p>
          <ul className="flex flex-col gap-1">
            {LEVELS[key].map((level, i) => (
              <li key={level} className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colors?.[key]?.[i] ?? "transparent" }}
                  aria-hidden="true"
                />
                {level}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

interface HazardToggleControlProps {
  active: Set<HazardKey>
  onToggle: (key: HazardKey) => void
}

function HazardToggleControl({ active, onToggle }: HazardToggleControlProps) {
  return (
    <div
      data-html2canvas-ignore="true"
      className="absolute left-3 top-3 z-[400] flex flex-col gap-1.5 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
    >
      <p className="font-medium text-foreground">Amenazas y pronóstico</p>
      {(Object.keys(HAZARD_META) as HazardKey[]).map((key) => {
        const Icon = HAZARD_META[key].icon
        return (
          <label key={key} className="flex items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={active.has(key)}
              onChange={() => onToggle(key)}
              className="size-3.5 accent-primary"
            />
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {HAZARD_META[key].label}
          </label>
        )
      })}
    </div>
  )
}

/**
 * Focused hazard map for the "Conoce tu nivel de exposición" popup
 * (see components/exposicion/exposicion-panel.tsx). Fits and outlines a
 * single vereda, then overlays whichever of the four hazards are toggled
 * on — each toggle bundling that hazard's threat/susceptibility layer with
 * its live forecast, mirroring the four full hazard maps
 * (components/maps/{deslizamientos,geoglows,incendios,precipitacion}-live-map.tsx)
 * this reuses styling and data sources from, but built fresh rather than
 * merging those components together. Precipitación is the only one of the
 * four with coverage for Zarzal — see lib/precipitacion/server.ts — so it's
 * on by default alongside the others rather than left for the user to find.
 */
function ExposicionMapImpl({ vereda }: { vereda: VeredaListEntry }) {
  const [active, setActive] = useState<Set<HazardKey>>(
    new Set(["deslizamientos", "inundaciones", "incendios", "precipitacion"]),
  )
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback((key: HazardKey) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const showDeslizamientos = active.has("deslizamientos")
  const showInundaciones = active.has("inundaciones")
  const showIncendios = active.has("incendios")
  const showPrecipitacion = active.has("precipitacion")

  const { data: deslizamientos } = useSWR<DeslizamientosResponse>(
    showDeslizamientos ? "/api/deslizamientos" : null,
    deslizamientosFetcher,
    { revalidateOnFocus: false },
  )
  const { data: inundaciones } = useSWR<InundacionesSusceptibilidadResponse>(
    showInundaciones ? "/api/inundaciones/susceptibilidad" : null,
    inundacionesFetcher,
    { revalidateOnFocus: false },
  )
  const { data: incendios } = useSWR<IncendiosAmenazaResponse>(
    showIncendios ? "/api/incendios/amenaza" : null,
    incendiosFetcher,
    { revalidateOnFocus: false },
  )
  const { data: fires } = useSWR<FiresResponse>(
    showIncendios ? "/api/incendios?days=2" : null,
    firesFetcher,
    { revalidateOnFocus: false },
  )
  const { data: precipitacion } = useSWR<PrecipitacionAmenazaResponse>(
    showPrecipitacion ? "/api/precipitacion/amenaza" : null,
    precipitacionFetcher,
    { revalidateOnFocus: false },
  )

  const [resolvedColors, setResolvedColors] = useState<{
    deslizamientos: Record<string, string>
    inundaciones: Record<string, string>
    incendios: Record<string, string>
    precipitacion: Record<string, string>
    fires: Record<string, string>
  } | null>(null)

  useEffect(() => {
    setResolvedColors({
      deslizamientos: Object.fromEntries(
        SUSCEPTIBILITY_LEVELS.map((l) => [l, resolveCssColor(levelColorToken(l))] as const),
      ),
      inundaciones: Object.fromEntries(
        FLOOD_SUSCEPTIBILITY_LEVELS.map((l) => [l, resolveCssColor(floodSusceptibilityColorToken(l))] as const),
      ),
      incendios: Object.fromEntries(
        FIRE_THREAT_LEVELS.map((l) => [l, resolveCssColor(fireLevelColorToken(l))] as const),
      ),
      precipitacion: Object.fromEntries(
        PRECIPITATION_LEVELS.map((l) => [l, resolveCssColor(precipitationLevelColorToken(l))] as const),
      ),
      fires: Object.fromEntries(
        (Object.keys(CONFIDENCE_STYLES) as Array<keyof typeof CONFIDENCE_STYLES>).map(
          (k) => [k, resolveCssColor(CONFIDENCE_STYLES[k].color)] as const,
        ),
      ),
    })
  }, [])

  const inundacionesStyle = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.descripcio as string | undefined
      const color = (level && resolvedColors?.inundaciones[level]) || "var(--muted-foreground)"
      return { color, weight: 1, fillColor: color, fillOpacity: 0.45 }
    },
    [resolvedColors],
  )
  const onEachInundacionesFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const nivel = feature.properties?.descripcio as string | undefined
    layer.bindPopup(
      `<div style="font-size:13px"><strong>Susceptibilidad a inundación</strong><br/>${nivel ?? "—"}</div>`,
    )
  }, [])

  const incendiosStyle = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.Amenaza_Label as string | undefined
      const color = (level && resolvedColors?.incendios[level]) || "var(--muted-foreground)"
      return { color, weight: 1, fillColor: color, fillOpacity: 0.5 }
    },
    [resolvedColors],
  )
  const onEachIncendiosFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const vereda_ = feature.properties?.NOMBRE_VER as string | undefined
    const municipio = feature.properties?.NOMB_MPIO as string | undefined
    const nivel = feature.properties?.Amenaza_Label as string | undefined
    layer.bindPopup(
      `<div style="font-size:13px"><strong>${vereda_ ?? municipio ?? "—"}</strong><br/>Amenaza: ${nivel ?? "—"}</div>`,
    )
  }, [])

  const precipitacionStyle = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const level = feature?.properties?.nivel as string | undefined
      const color = (level && resolvedColors?.precipitacion[level]) || "var(--muted-foreground)"
      return { color, weight: 1, fillColor: color, fillOpacity: 0.45 }
    },
    [resolvedColors],
  )
  const onEachPrecipitacionFeature = useCallback((feature: GeoJSON.Feature, layer: Layer) => {
    const nivel = feature.properties?.nivel as string | undefined
    const acumulado = feature.properties?.acumuladoMm as number | undefined
    layer.bindPopup(
      `<div style="font-size:13px"><strong>Lluvia acumulada (7 días)</strong><br/>Nivel: ${nivel ?? "—"}<br/>${
        acumulado != null ? `${acumulado} mm` : "sin dato"
      }</div>`,
    )
  }, [])

  const deslizamientosPoints = useMemo(() => deslizamientos?.points.features ?? [], [deslizamientos])

  const veredaOutline = useMemo(() => toLatLngRings(vereda.polygons), [vereda])

  const activeHazardKeys = useMemo(
    () => (Object.keys(HAZARD_META) as HazardKey[]).filter((k) => active.has(k)),
    [active],
  )

  async function handleExportPdf() {
    if (!captureRef.current) return
    setExporting(true)
    setExportError(null)
    try {
      // The original html2canvas can't parse modern CSS color functions
      // (lab()/oklch()) our Tailwind v4 design tokens resolve to, and throws
      // instead of rendering — html2canvas-pro is a maintained fork that
      // adds support for them.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ])
      const canvas = await html2canvas(captureRef.current, {
        useCORS: true,
        backgroundColor: "#ffffff",
        scale: 2,
      })
      const imgData = canvas.toDataURL("image/png")

      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 32

      pdf.setFontSize(16)
      pdf.text("Conoce tu nivel de exposición", margin, margin)
      pdf.setFontSize(11)
      pdf.text(`${vereda.nombre}, ${vereda.municipio}`, margin, margin + 20)
      const layersLabel =
        activeHazardKeys.length > 0
          ? activeHazardKeys.map((k) => HAZARD_META[k].label).join(", ")
          : "Ninguna amenaza seleccionada"
      pdf.text(`Amenazas mostradas: ${layersLabel}`, margin, margin + 36)
      pdf.text(`Generado: ${new Date().toLocaleString("es-CO")}`, margin, margin + 52)

      const imgTop = margin + 68
      const maxWidth = pageWidth - margin * 2
      const maxHeight = pageHeight - imgTop - margin
      const scaleRatio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
      const imgWidth = canvas.width * scaleRatio
      const imgHeight = canvas.height * scaleRatio

      pdf.addImage(imgData, "PNG", margin, imgTop, imgWidth, imgHeight)
      pdf.save(`exposicion-${vereda.municipio.toLowerCase()}-${vereda.nombre.toLowerCase()}.pdf`)
    } catch (err) {
      console.error("[v0] Export a PDF falló:", err)
      setExportError("No se pudo generar el PDF. Intenta de nuevo.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex items-center justify-end gap-3 border-b border-border bg-card px-4 py-2 print:hidden"
        data-html2canvas-ignore="true"
      >
        {exportError && <p className="text-xs text-destructive">{exportError}</p>}
        <Button size="sm" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? (
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" aria-hidden="true" />
          ) : (
            <Download data-icon="inline-start" aria-hidden="true" />
          )}
          Exportar como PDF
        </Button>
      </div>

      <div ref={captureRef} className="relative min-h-0 flex-1">
        <MapContainer
          center={vereda.center}
          zoom={13}
          zoomControl={false}
          attributionControl={false}
          className="h-full w-full"
        >
          <ZoomControl position="topright" />
          <AttributionControl position="bottomright" prefix="Leaflet" />
          <BasemapTileLayer crossOrigin="anonymous" />

          <FitToVereda vereda={vereda} />

          <Polygon
            positions={veredaOutline}
            pathOptions={{ color: "var(--primary)", weight: 2, fill: false, dashArray: "6 4" }}
          />

          {showDeslizamientos && (
            <>
              <TileLayer attribution="NASA GIBS / SMAP" url={SMAP_TILE_URL} opacity={0.55} maxNativeZoom={6} crossOrigin="anonymous" />
              {resolvedColors &&
                deslizamientosPoints.map((feature, i) => {
                  const [lon, lat] = feature.geometry.coordinates
                  const nivel = normalizeSusceptibilityLevel(feature.properties.IS_nivel)
                  const color = (nivel && resolvedColors.deslizamientos[nivel]) || "var(--muted-foreground)"
                  return (
                    <CircleMarker
                      key={`ds-${i}`}
                      center={[lat, lon]}
                      radius={3}
                      pathOptions={{ color, weight: 0, fillColor: color, fillOpacity: 0.8 }}
                    >
                      <Popup>
                        <div style={{ fontSize: 13 }}>
                          <strong>{feature.properties.municipio ?? "—"}</strong>
                          <br />
                          Susceptibilidad: {nivel ?? "—"}
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
            </>
          )}

          {showInundaciones && (
            <>
              {inundaciones?.polygons && resolvedColors && (
                <GeoJSON
                  key="inundaciones"
                  data={inundaciones.polygons as unknown as GeoJSON.GeoJsonObject}
                  style={inundacionesStyle}
                  onEachFeature={onEachInundacionesFeature}
                />
              )}
              <GeoglowsOverlay />
            </>
          )}

          {showIncendios && (
            <>
              <WMSTileLayer
                url={GWIS_WMS_URL}
                opacity={0.55}
                crossOrigin="anonymous"
                params={
                  {
                    layers: GWIS_FWI_LAYER,
                    format: "image/png",
                    transparent: true,
                    version: "1.1.1",
                    TIME: new Date().toISOString().slice(0, 10),
                  } as WMSParams
                }
              />
              {incendios?.polygons && resolvedColors && (
                <GeoJSON
                  key="incendios"
                  data={incendios.polygons as unknown as GeoJSON.GeoJsonObject}
                  style={incendiosStyle}
                  onEachFeature={onEachIncendiosFeature}
                />
              )}
              {resolvedColors &&
                fires?.detections.map((d) => (
                  <CircleMarker
                    key={d.id}
                    center={[d.lat, d.lon]}
                    radius={5}
                    pathOptions={{
                      color: "#fff",
                      weight: 1,
                      fillColor: resolvedColors.fires[d.confidence],
                      fillOpacity: 0.85,
                    }}
                  >
                    <Popup>
                      <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
                        <strong>{formatDateTime(d.acquiredAt)}</strong>
                        <span>
                          Cerca de {d.nearest.name} · {formatDistance(d.nearest.distanceKm)}
                        </span>
                        <span>FRP: {formatFrp(d.frp)}</span>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
            </>
          )}

          {showPrecipitacion && (
            <>
              <TileLayer attribution="NASA GIBS / IMERG" url={IMERG_TILE_URL} opacity={0.5} maxNativeZoom={6} crossOrigin="anonymous" />
              {precipitacion?.veredas && resolvedColors && (
                <GeoJSON
                  key="precipitacion"
                  data={precipitacion.veredas as unknown as GeoJSON.GeoJsonObject}
                  style={precipitacionStyle}
                  onEachFeature={onEachPrecipitacionFeature}
                />
              )}
            </>
          )}
        </MapContainer>

        <HazardToggleControl active={active} onToggle={toggle} />
        <HazardLegend hazardKeys={activeHazardKeys} />
      </div>
    </div>
  )
}

// Leaflet touches `window` at module load time, so this component is always
// consumed through ExposicionMapLoader (next/dynamic, ssr: false).
export default ExposicionMapImpl
