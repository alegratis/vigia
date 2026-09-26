"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { useTheme } from "next-themes"
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  AttributionControl,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre"
import { setWorkerUrl } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// See deslizamientos-live-map.tsx for why this self-hosted worker override
// is needed under Turbopack.
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs")
}
import useSWR from "swr"
import { Download, Loader2, Mountain, Droplets, Flame, CloudRain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { maplibreBasemapStyle } from "@/lib/maps/maplibre-basemap-style"
import { wmsRasterSource } from "@/lib/maps/wms-raster-source"
import { SUSCEPTIBILITY_LEVELS, levelColorToken } from "@/lib/deslizamientos/levels"
import { useVeredas } from "@/lib/veredas/use-veredas"
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
import type { InundacionesSusceptibilidadResponse } from "@/lib/inundaciones/api-types"
import type { IncendiosAmenazaResponse } from "@/lib/incendios/api-types"
import type { PrecipitacionAmenazaResponse } from "@/lib/precipitacion/api-types"
import type { FiresResponse } from "@/lib/firms/api-types"

/**
 * MapLibre GL port (see v0_plans/grand-method.md, Phase 3) — follows the
 * other hazard maps' patterns. No hazard data/model/API logic changed.
 */

type HazardKey = "deslizamientos" | "inundaciones" | "incendios" | "precipitacion"

const HAZARD_META: Record<HazardKey, { label: string; icon: typeof Mountain }> = {
  deslizamientos: { label: "Deslizamientos", icon: Mountain },
  inundaciones: { label: "Inundaciones", icon: Droplets },
  incendios: { label: "Incendios", icon: Flame },
  precipitacion: { label: "Precipitación", icon: CloudRain },
}

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
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
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
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
      className="absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
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
  const mapRef = useRef<MapRef>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const mapStyle = useMemo(() => maplibreBasemapStyle(isDark), [isDark])

  const [is3D, setIs3D] = useState(false)
  const setMapPitch = useCallback((next: boolean) => {
    const map = mapRef.current?.getMap()
    if (map) map.easeTo(next ? { pitch: 55, bearing: -12, duration: 800 } : { pitch: 0, bearing: 0, duration: 600 })
    setIs3D(next)
  }, [])

  const [active, setActive] = useState<Set<HazardKey>>(
    new Set(["deslizamientos", "inundaciones", "incendios", "precipitacion"]),
  )
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")
  const [overlay, setOverlay] = useState<{ bounds: GeoglowsBounds; width: number; height: number } | null>(null)
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

  const { veredas: veredasHazard } = useVeredas(showDeslizamientos)
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
  const { data: fires } = useSWR<FiresResponse>(showIncendios ? "/api/incendios?days=2" : null, firesFetcher, {
    revalidateOnFocus: false,
  })
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
  const [noDataColor, setNoDataColor] = useState<string | null>(null)
  const [outlineColor, setOutlineColor] = useState<string | null>(null)

  useEffect(() => {
    setOutlineColor(resolveCssColor("var(--primary)"))
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
    setNoDataColor(resolveCssColor("var(--muted-foreground)"))
  }, [])

  const veredaOutlineGeoJson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "MultiPolygon", coordinates: vereda.polygons },
        },
      ],
    }),
    [vereda],
  )

  const veredaHazardFeature = useMemo(
    () => veredasHazard?.features.find((f) => f.properties.codigoVereda === vereda.codigoVereda) ?? null,
    [veredasHazard, vereda.codigoVereda],
  )

  const deslizamientosGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredaHazardFeature || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    const nivel = veredaHazardFeature.properties.dominantLevel
    const color = (nivel && resolvedColors.deslizamientos[nivel]) || noDataColor
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { nivel: nivel ?? null, __color: color },
          geometry: { type: "MultiPolygon", coordinates: veredaHazardFeature.geometry.coordinates },
        },
      ],
    }
  }, [veredaHazardFeature, resolvedColors, noDataColor])

  const inundacionesGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!inundaciones?.polygons || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: inundaciones.polygons.features.map((feature, i) => {
        const nivel = feature.properties?.descripcio as string | undefined
        const color = (nivel && resolvedColors.inundaciones[nivel]) || noDataColor
        return {
          type: "Feature",
          id: `inundaciones-${i}`,
          properties: { ...feature.properties, __color: color },
          geometry: feature.geometry,
        }
      }),
    } as GeoJSON.FeatureCollection
  }, [inundaciones, resolvedColors, noDataColor])

  const incendiosGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!incendios?.polygons || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: incendios.polygons.features.map((feature, i) => {
        const nivel = feature.properties?.Amenaza_Label as string | undefined
        const color = (nivel && resolvedColors.incendios[nivel]) || noDataColor
        return {
          type: "Feature",
          id: `incendios-${i}`,
          properties: { ...feature.properties, __color: color },
          geometry: feature.geometry,
        }
      }),
    } as GeoJSON.FeatureCollection
  }, [incendios, resolvedColors, noDataColor])

  const firesGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!fires?.detections || !resolvedColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: fires.detections.map((d) => ({
        type: "Feature",
        id: d.id,
        properties: { ...d, __color: resolvedColors.fires[d.confidence] },
        geometry: { type: "Point", coordinates: [d.lon, d.lat] },
      })),
    }
  }, [fires, resolvedColors])

  const precipitacionGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!precipitacion?.veredas || !resolvedColors || !noDataColor) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: precipitacion.veredas.features.map((feature, i) => {
        const nivel = feature.properties?.nivel as string | undefined
        const color = (nivel && resolvedColors.precipitacion[nivel]) || noDataColor
        return {
          type: "Feature",
          id: `precipitacion-${i}`,
          properties: { ...feature.properties, __color: color },
          geometry: feature.geometry,
        }
      }),
    } as GeoJSON.FeatureCollection
  }, [precipitacion, resolvedColors, noDataColor])

  const forecastSource = useMemo(
    () => wmsRasterSource(GWIS_WMS_URL, GWIS_FWI_LAYER, { TIME: new Date().toISOString().slice(0, 10) }),
    [],
  )

  const overlayUrl = useMemo(() => {
    if (!overlay) return null
    return buildProxyExportUrl(overlay.bounds, overlay.width, overlay.height)
  }, [overlay])

  const reachImageCoordinates = useMemo<
    [[number, number], [number, number], [number, number], [number, number]] | null
  >(() => {
    if (!overlay) return null
    const { north, south, east, west } = overlay.bounds
    return [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ]
  }, [overlay])

  const activeHazardKeys = useMemo(
    () => (Object.keys(HAZARD_META) as HazardKey[]).filter((k) => active.has(k)),
    [active],
  )

  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = []
    if (showDeslizamientos) ids.push("deslizamientos-fill")
    if (showInundaciones) ids.push("inundaciones-fill")
    if (showIncendios) ids.push("incendios-fill", "fires")
    if (showPrecipitacion) ids.push("precipitacion-fill")
    return ids
  }, [showDeslizamientos, showInundaciones, showIncendios, showPrecipitacion])

  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    const { lng, lat } = e.lngLat
    const deslizamientosFeature = e.features?.find((f) => f.layer.id === "deslizamientos-fill")
    if (deslizamientosFeature) {
      const nivel = deslizamientosFeature.properties?.nivel as string | undefined
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        content: (
          <div style={{ fontSize: 13 }}>
            <strong>Amenaza (modelo propio)</strong>
            <br />
            {nivel ?? "Sin datos del modelo"}
          </div>
        ),
      })
      return
    }
    const inundacionesFeature = e.features?.find((f) => f.layer.id === "inundaciones-fill")
    if (inundacionesFeature) {
      const nivel = inundacionesFeature.properties?.descripcio as string | undefined
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        content: (
          <div style={{ fontSize: 13 }}>
            <strong>Susceptibilidad a inundación</strong>
            <br />
            {nivel ?? "—"}
          </div>
        ),
      })
      return
    }
    const firesFeature = e.features?.find((f) => f.layer.id === "fires")
    if (firesFeature) {
      const props = firesFeature.properties as unknown as {
        acquiredAt: string
        nearest: { name: string; distanceKm: number }
        frp: number
      }
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        content: (
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 2 }}>
            <strong>{formatDateTime(props.acquiredAt)}</strong>
            <span>
              Cerca de {props.nearest.name} · {formatDistance(props.nearest.distanceKm)}
            </span>
            <span>FRP: {formatFrp(props.frp)}</span>
          </div>
        ),
      })
      return
    }
    const incendiosFeature = e.features?.find((f) => f.layer.id === "incendios-fill")
    if (incendiosFeature) {
      const veredaNombre = incendiosFeature.properties?.NOMBRE_VER as string | undefined
      const municipio = incendiosFeature.properties?.NOMB_MPIO as string | undefined
      const nivel = incendiosFeature.properties?.Amenaza_Label as string | undefined
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        content: (
          <div style={{ fontSize: 13 }}>
            <strong>{veredaNombre ?? municipio ?? "—"}</strong>
            <br />
            Amenaza: {nivel ?? "—"}
          </div>
        ),
      })
      return
    }
    const precipitacionFeature = e.features?.find((f) => f.layer.id === "precipitacion-fill")
    if (precipitacionFeature) {
      const nivel = precipitacionFeature.properties?.nivel as string | undefined
      const acumulado = precipitacionFeature.properties?.acumuladoMm as number | undefined
      setPopupInfo({
        longitude: lng,
        latitude: lat,
        content: (
          <div style={{ fontSize: 13 }}>
            <strong>Lluvia acumulada (7 días)</strong>
            <br />
            Nivel: {nivel ?? "—"}
            <br />
            {acumulado != null ? `${acumulado} mm` : "sin dato"}
          </div>
        ),
      })
      return
    }
    setPopupInfo(null)
  }, [])

  const syncOverlay = useCallback(() => {
    const map = mapRef.current?.getMap()
    const b = map?.getBounds()
    const canvas = map?.getCanvas()
    if (!b || !canvas) return
    setOverlay({
      bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
      width: canvas.width,
      height: canvas.height,
    })
  }, [])

  const veredaBounds = useMemo<[[number, number], [number, number]]>(() => {
    const [south, west, north, east] = vereda.bbox
    return [
      [west, south],
      [east, north],
    ]
  }, [vereda])

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    map.fitBounds(veredaBounds, { padding: 24, duration: 0 })
  }, [veredaBounds])

  async function handleExportPdf() {
    if (!captureRef.current) return
    setExporting(true)
    setExportError(null)
    try {
      // The original html2canvas can't parse modern CSS color functions
      // (lab()/oklch()) our Tailwind v4 design tokens resolve to, and throws
      // instead of rendering — html2canvas-pro is a maintained fork that
      // adds support for them.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")])
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
        <Map
          ref={mapRef}
          initialViewState={{ bounds: veredaBounds }}
          mapStyle={mapStyle}
          attributionControl={false}
          cursor={cursor}
          interactiveLayerIds={interactiveLayerIds}
          onLoad={syncOverlay}
          onMoveEnd={syncOverlay}
          onZoomEnd={syncOverlay}
          onMouseEnter={() => setCursor("pointer")}
          onMouseLeave={() => setCursor("")}
          onClick={handleMapClick}
          style={{ width: "100%", height: "100%" }}
        >
    <NavigationControl position="top-right" />
  <MapViewToggleControl is3D={is3D} onToggle={() => setMapPitch(!is3D)} position="top-right" />
  <AttributionControl position="bottom-right" customAttribution="MapLibre © OpenStreetMap / CARTO" compact />

          <Source id="vereda-outline-source" type="geojson" data={veredaOutlineGeoJson}>
            <Layer
              id="vereda-outline"
              type="line"
              paint={{ "line-color": outlineColor ?? "#888888", "line-width": 2, "line-dasharray": [6, 4] }}
            />
          </Source>

          {showDeslizamientos && (
            <>
              <Source id="smap-source" type="raster" tiles={[SMAP_TILE_URL]} tileSize={256} maxzoom={6}>
                <Layer id="smap" type="raster" paint={{ "raster-opacity": 0.55 }} />
              </Source>
              <Source id="deslizamientos-source" type="geojson" data={deslizamientosGeoJson}>
                <Layer
                  id="deslizamientos-fill"
                  type="fill"
                  paint={{ "fill-color": ["get", "__color"], "fill-opacity": 0.5 }}
                />
                <Layer id="deslizamientos-line" type="line" paint={{ "line-color": "#ffffff", "line-width": 1 }} />
              </Source>
            </>
          )}

          {showInundaciones && (
            <>
              <Source id="inundaciones-source" type="geojson" data={inundacionesGeoJson}>
                <Layer
                  id="inundaciones-fill"
                  type="fill"
                  paint={{ "fill-color": ["get", "__color"], "fill-opacity": 0.45 }}
                />
                <Layer
                  id="inundaciones-line"
                  type="line"
                  paint={{ "line-color": ["get", "__color"], "line-width": 1 }}
                />
              </Source>
              {reachImageCoordinates && overlayUrl && (
                <Source id="geoglows-image-source" type="image" url={overlayUrl} coordinates={reachImageCoordinates}>
                  <Layer id="geoglows-image" type="raster" paint={{ "raster-opacity": 0.9 }} />
                </Source>
              )}
            </>
          )}

          {showIncendios && (
            <>
              <Source
                id="forecast-source"
                type="raster"
                tiles={forecastSource.tiles}
                tileSize={forecastSource.tileSize}
              >
                <Layer id="forecast" type="raster" paint={{ "raster-opacity": 0.55 }} />
              </Source>
              <Source id="incendios-source" type="geojson" data={incendiosGeoJson}>
                <Layer
                  id="incendios-fill"
                  type="fill"
                  paint={{ "fill-color": ["get", "__color"], "fill-opacity": 0.5 }}
                />
                <Layer id="incendios-line" type="line" paint={{ "line-color": ["get", "__color"], "line-width": 1 }} />
              </Source>
              <Source id="fires-source" type="geojson" data={firesGeoJson}>
                <Layer
                  id="fires"
                  type="circle"
                  paint={{
                    "circle-radius": 5,
                    "circle-color": ["get", "__color"],
                    "circle-stroke-color": "#ffffff",
                    "circle-stroke-width": 1,
                    "circle-opacity": 0.85,
                  }}
                />
              </Source>
            </>
          )}

          {showPrecipitacion && (
            <>
              <Source id="imerg-source" type="raster" tiles={[IMERG_TILE_URL]} tileSize={256} maxzoom={6}>
                <Layer id="imerg" type="raster" paint={{ "raster-opacity": 0.5 }} />
              </Source>
              <Source id="precipitacion-source" type="geojson" data={precipitacionGeoJson}>
                <Layer
                  id="precipitacion-fill"
                  type="fill"
                  paint={{ "fill-color": ["get", "__color"], "fill-opacity": 0.45 }}
                />
                <Layer
                  id="precipitacion-line"
                  type="line"
                  paint={{ "line-color": ["get", "__color"], "line-width": 1 }}
                />
              </Source>
            </>
          )}

          {popupInfo && (
            <Popup
              longitude={popupInfo.longitude}
              latitude={popupInfo.latitude}
              onClose={() => setPopupInfo(null)}
              closeOnClick={false}
              anchor="bottom"
            >
              {popupInfo.content}
            </Popup>
          )}
        </Map>

        <HazardToggleControl active={active} onToggle={toggle} />
        <HazardLegend hazardKeys={activeHazardKeys} />
      </div>
    </div>
  )
}

// MapLibre touches `window` at module load time, so this component is
// always consumed through ExposicionMapLoader (next/dynamic, ssr: false).
export default ExposicionMapImpl
