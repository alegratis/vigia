"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
import { Building2, Home, Users, TriangleAlert } from "lucide-react"
import { MapControlRail, RailSection } from "@/components/maps/map-control-rail"
import { MapViewToggleControl } from "@/components/maps/map-view-toggle-control"
import { MapBasemapControl } from "@/components/maps/map-basemap-control"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { cn } from "@/lib/utils"
import { maplibreMapStyle, defaultBasemapForCurrentTheme, type BasemapType } from "@/lib/maps/maplibre-basemap-style"
import { useDemografiaGeoportal } from "@/lib/demografia/use-geoportal"
import { useVulnerabilidad } from "@/lib/vulnerabilidad/use-vulnerabilidad"
import { INDICATOR_LEVELS, INDICATOR_LEVEL_TOKENS, normalize, indicatorLevel, indicatorHeight } from "@/lib/demografia/indicator-levels"
import { VULNERABILITY_LEVELS, VULNERABILITY_LEVEL_STYLES, vulnerabilityLevelColorToken } from "@/lib/vulnerabilidad/levels"
import { HVI_COMPONENT_LABELS, HVI_COMPONENT_ORDER } from "@/lib/vulnerabilidad/hvi-components"
import { VulnerabilityBreakdownChart } from "@/components/charts/vulnerability-breakdown-chart"
import type { VulnerabilidadVeredaProperties, VulnerabilidadResponse } from "@/lib/vulnerabilidad/api-types"
import type { PobrezaFeatureProperties, ManzanaFeatureProperties } from "@/lib/demografia/geoportal-api-types"
import type { MapBounds } from "@/lib/map-bounds"

// Same 4-municipio AOI as every other hazard map (Sevilla, Caicedonia, Zarzal, Roldanillo).
const AOI_BOUNDS: [[number, number], [number, number]] = [
  [-76.06, 3.88],
  [-75.72, 4.44],
]

type Indicator = "pobreza" | "manzanas" | "vulnerabilidad"
type ManzanaField = "viviendas" | "hogares" | "personas"

const MANZANA_FIELD_LABEL: Record<ManzanaField, string> = {
  viviendas: "Viviendas",
  hogares: "Hogares",
  personas: "Personas",
}

const MANZANA_FIELD_ICON: Record<ManzanaField, typeof Home> = {
  viviendas: Home,
  hogares: Building2,
  personas: Users,
}

interface PopupInfo {
  longitude: number
  latitude: number
  content: ReactNode
}

/** Same quintile cutoffs as `vulnerabilityLevelFromScore` (lib/vulnerabilidad/combined-score.ts), applied directly to a 0–1 HVI value so individual manzana/component bars can be colored on the same 5-tier scale even though they aren't combined scores themselves. */
function vulnerabilityLevelFromNormalized(value: number): (typeof VULNERABILITY_LEVELS)[number] {
  if (value < 0.2) return "Muy bajo"
  if (value < 0.4) return "Bajo"
  if (value < 0.6) return "Moderado"
  if (value < 0.8) return "Alto"
  return "Muy alto"
}

/** Short, plain-language explainer reused by both the map popup (compact) and the below-map panel (below, in full) — what the index is, how to read it, what it's for. */
const HVI_EXPLAINER = {
  what: "El HVI mide qué tan frágil es la vivienda: paredes, pisos, hacinamiento y acceso a acueducto/alcantarillado/energía/basuras.",
  read: "0 = la vivienda menos frágil de los 4 municipios estudiados; 1 = la más frágil. En cascos urbanos se calcula manzana por manzana; en veredas rurales, por municipio completo.",
  use: "Multiplicado por la amenaza física (riesgo compuesto) da la vulnerabilidad combinada: dónde la gente vive en peores condiciones Y está más expuesta al peligro — la prioridad más alta para intervención.",
}

/** Shared legend for both DANE indicators — same 5-tier normalized scale, just relabeled per indicator. */
function IndicatorLegend({ title }: { title: string }) {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(INDICATOR_LEVELS.map((level) => resolveCssColor(INDICATOR_LEVEL_TOKENS[level])))
  }, [])

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">{title}</p>
      <ul className="flex flex-col gap-1">
        {INDICATOR_LEVELS.map((level, i) => (
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

/** Legend for the combined-vulnerability layer — its own teal ramp (lib/vulnerabilidad/levels.ts), deliberately distinct from sismología's blue and riesgo-compuesto's violet so the three never read as the same color on the map or category rail. */
function VulnerabilityLegend() {
  const [colors, setColors] = useState<string[] | null>(null)

  useEffect(() => {
    setColors(VULNERABILITY_LEVELS.map((level) => resolveCssColor(VULNERABILITY_LEVEL_STYLES[level].colorToken)))
  }, [])

  return (
    <div className="pointer-events-none rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="font-medium text-foreground">Índice de vulnerabilidad compuesto</p>
      <p className="mb-1.5 text-[11px] text-muted-foreground">Por manzana en cascos urbanos · por vereda en zona rural</p>
      <ul className="flex flex-col gap-1">
        {VULNERABILITY_LEVELS.map((level, i) => (
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

/**
 * Demografía tab's map: extrudes DANE geoportal indicators in 3D over the
 * 4-municipio AOI. Three mutually exclusive top-level layers (never shown
 * together — pobreza and vulnerabilidad are both manzana-grain in the
 * urban cores, so stacking any two would be unreadable) — pobreza
 * multidimensional per manzana, viviendas/hogares/personas per manzana
 * censal (sub-toggle picks which count drives the extrusion), or the
 * combined vulnerability index. The vulnerability index itself renders as
 * *two* GeoJSON sources at once: one manzana per urban block (the actual
 * structure-level resolution the index is meant to speak to) plus one
 * polygon per rural vereda where DANE has nothing finer than
 * municipio-wide housing data. Structurally copied from
 * `sismologia-live-map.tsx`'s fill-extrusion block (basemap/theme
 * switching, NavigationControl, click-for-detail popups).
 */
function DemografiaLiveMapImpl({
  onBoundsChange,
  className,
}: {
  onBoundsChange?: (bounds: MapBounds) => void
  className?: string
}) {
  const mapRef = useRef<MapRef>(null)
  const [indicator, setIndicator] = useState<Indicator>("pobreza")
  const { data } = useDemografiaGeoportal(indicator !== "vulnerabilidad")
  const { data: vulnerabilidadData } = useVulnerabilidad(indicator === "vulnerabilidad")

  const [manzanaField, setManzanaField] = useState<ManzanaField>("personas")
  const [levelColors, setLevelColors] = useState<Record<string, string> | null>(null)
  const [vulnColors, setVulnColors] = useState<Record<string, string> | null>(null)
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)
  const [cursor, setCursor] = useState<string>("")

  useEffect(() => {
    setLevelColors(
      Object.fromEntries(INDICATOR_LEVELS.map((level) => [level, resolveCssColor(INDICATOR_LEVEL_TOKENS[level])])),
    )
    setVulnColors(
      Object.fromEntries(
        VULNERABILITY_LEVELS.map((level) => [level, resolveCssColor(VULNERABILITY_LEVEL_STYLES[level].colorToken)]),
      ),
    )
  }, [])

  // Always tilted — flat 2D fill-extrusion columns are invisible from directly overhead.
  const [is3D, setIs3D] = useState(true)
  const [basemap, setBasemap] = useState<BasemapType>(defaultBasemapForCurrentTheme)
  const mapStyle = useMemo(() => maplibreMapStyle(basemap, is3D), [basemap, is3D])
  const setMapPitch = useCallback((next: boolean) => {
    const map = mapRef.current?.getMap()
    if (map) map.easeTo(next ? { pitch: 55, bearing: -12, duration: 800 } : { pitch: 0, bearing: 0, duration: 600 })
    setIs3D(next)
  }, [])

  const pobrezaGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data || !levelColors) return { type: "FeatureCollection", features: [] }
    const values = data.pobreza.features.map((f) => f.properties.ipm)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    return {
      type: "FeatureCollection",
      features: data.pobreza.features.map((feature, i) => {
        const n = normalize(feature.properties.ipm, min, max)
        return {
          type: "Feature",
          id: i,
          properties: {
            ...feature.properties,
            __height: indicatorHeight(n),
            __color: levelColors[indicatorLevel(n)],
          },
          geometry: feature.geometry,
        }
      }),
    }
  }, [data, levelColors])

  const manzanasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!data || !levelColors) return { type: "FeatureCollection", features: [] }
    const values = data.manzanas.features.map((f) => f.properties[manzanaField])
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    return {
      type: "FeatureCollection",
      features: data.manzanas.features.map((feature, i) => {
        const n = normalize(feature.properties[manzanaField], min, max)
        return {
          type: "Feature",
          id: i,
          properties: {
            ...feature.properties,
            __height: indicatorHeight(n, 900),
            __color: levelColors[indicatorLevel(n)],
          },
          geometry: feature.geometry,
        }
      }),
    }
  }, [data, levelColors, manzanaField])

  // Step 3 of the vulnerability methodology (lib/vulnerabilidad/combined-score.ts):
  // combinedScore has a fixed theoretical range [0, 4] (HVI ∈ [0,1] × HazardScore ∈ [1,4]),
  // so this is bucketed by the API's own combinedLevel rather than re-normalized client-side.
  // Rural veredas only now — urban cores are their own manzana-level layer below, each
  // block keeping its own HVI instead of being flattened into one municipio-wide shape.
  const vulnerabilidadGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!vulnerabilidadData || !vulnColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: vulnerabilidadData.veredas.features
        .filter((f) => f.properties.combinedScore != null && f.properties.combinedLevel != null)
        .map((feature, i) => {
          const level = feature.properties.combinedLevel as string
          const height = indicatorHeight((feature.properties.combinedScore ?? 0) / 4, 900)
          return {
            type: "Feature",
            id: i,
            properties: {
              ...feature.properties,
              __height: height,
              __color: vulnColors?.[level],
            },
            geometry: feature.geometry,
          }
        }),
    }
  }, [vulnerabilidadData, vulnColors])

  // Same combined-score methodology as above, applied per manzana instead of
  // per municipio — this is the actual block-level resolution DANE supports
  // in the urban cores, so each city block gets its own extruded polygon.
  const vulnerabilidadManzanasGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!vulnerabilidadData || !vulnColors) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: vulnerabilidadData.manzanas.features
        .filter((f) => f.properties.combinedScore != null && f.properties.combinedLevel != null)
        .map((feature, i) => {
          const level = feature.properties.combinedLevel as string
          const height = indicatorHeight((feature.properties.combinedScore ?? 0) / 4, 900)
          return {
            type: "Feature",
            id: i,
            properties: {
              ...feature.properties,
              __height: height,
              __color: vulnColors?.[level],
            },
            geometry: feature.geometry,
          }
        }),
    }
  }, [vulnerabilidadData, vulnColors])

  const interactiveLayerIds = useMemo(() => {
    if (indicator === "pobreza") return ["pobreza-columns"]
    if (indicator === "manzanas") return ["manzanas-columns"]
    return ["vulnerabilidad-columns", "vulnerabilidad-manzanas-columns"]
  }, [indicator])

  const handleMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) {
        setPopupInfo(null)
        return
      }
      if (feature.layer.id === "pobreza-columns") {
        const props = feature.properties as unknown as PobrezaFeatureProperties
        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          content: (
            <div className="flex flex-col gap-1 text-xs">
              <p className="font-medium text-foreground">
                Manzana {props.codigoManzana} <span className="text-muted-foreground">({props.municipio})</span>
              </p>
              <p className="text-muted-foreground">
                IPM: <span className="font-medium text-foreground">{props.ipm.toFixed(1)}%</span>
              </p>
              <p className="text-muted-foreground">
                Categoría: <span className="font-medium text-foreground">{props.categoria}</span>
              </p>
              <p className="border-t border-border pt-1.5 leading-snug text-muted-foreground">
                Índice de Pobreza Multidimensional (IPM) del DANE, calculado por manzana censal — el porcentaje de
                privaciones (vivienda, servicios, educación, salud) que sufren los hogares de esta manzana.
              </p>
            </div>
          ),
        })
      } else if (feature.layer.id === "manzanas-columns") {
        const props = feature.properties as unknown as ManzanaFeatureProperties
        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          content: (
            <div className="flex flex-col gap-1 text-xs">
              <p className="font-medium text-foreground">Manzana {props.codigoManzana}</p>
              <p className="text-muted-foreground">
                Viviendas: <span className="font-medium text-foreground">{props.viviendas.toLocaleString("es-CO")}</span>
              </p>
              <p className="text-muted-foreground">
                Hogares: <span className="font-medium text-foreground">{props.hogares.toLocaleString("es-CO")}</span>
              </p>
              <p className="text-muted-foreground">
                Personas: <span className="font-medium text-foreground">{props.personas.toLocaleString("es-CO")}</span>
              </p>
            </div>
          ),
        })
      } else if (feature.layer.id === "vulnerabilidad-columns") {
        // Rural vereda — always municipio-wide, since the census has no
        // manzana breakdown outside urban cores.
        const props = feature.properties as unknown as VulnerabilidadVeredaProperties
        const ruralSummary = vulnerabilidadData?.hviPorMunicipio.find((m) => m.municipio === props.municipio)

        const breakdownRows = ruralSummary
          ? HVI_COMPONENT_ORDER.map((key) => ({
              label: HVI_COMPONENT_LABELS[key],
              value: ruralSummary.components[key] ?? 0,
              color: resolveCssColor(
                VULNERABILITY_LEVEL_STYLES[vulnerabilityLevelFromNormalized((ruralSummary.components[key] ?? 0) / 100)]
                  .colorToken,
              ),
            }))
          : []

        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          content: (
            <div className="flex w-64 flex-col gap-2 text-xs">
              <div>
                <p className="font-medium text-foreground">
                  {props.nombre} <span className="text-muted-foreground">({props.municipio})</span>
                </p>
                <p className="text-muted-foreground">
                  Vulnerabilidad compuesta:{" "}
                  <span className="font-medium text-foreground">{props.combinedLevel}</span>
                </p>
                <p className="text-muted-foreground">
                  HVI (por municipio): <span className="font-medium text-foreground">{props.hvi.toFixed(2)}</span>
                  {" · "}
                  Amenaza: <span className="font-medium text-foreground">{props.compoundLevel ?? "—"}</span>
                </p>
              </div>
              {breakdownRows.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-foreground">Componentes de déficit habitacional</p>
                  <VulnerabilityBreakdownChart rows={breakdownRows} valueSuffix="%" height={breakdownRows.length * 26 + 12} compact />
                </div>
              )}
              <p className="border-t border-border pt-1.5 leading-snug text-muted-foreground">{HVI_EXPLAINER.what}</p>
            </div>
          ),
        })
      } else if (feature.layer.id === "vulnerabilidad-manzanas-columns") {
        // Urban core — this one manzana's own HVI, not a municipio average.
        // Every manzana in the same urban core shares its hazard tier, since
        // riesgo compuesto doesn't resolve finer than the "Casco Urbano" vereda.
        const props = feature.properties as unknown as {
          codigoManzana: string
          municipio: string
          hvi: number
          combinedLevel: string
          compoundLevel: string | null
        }
        setPopupInfo({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          content: (
            <div className="flex w-64 flex-col gap-2 text-xs">
              <div>
                <p className="font-medium text-foreground">
                  Manzana {props.codigoManzana} <span className="text-muted-foreground">({props.municipio})</span>
                </p>
                <p className="text-muted-foreground">
                  Vulnerabilidad compuesta:{" "}
                  <span className="font-medium text-foreground">{props.combinedLevel}</span>
                </p>
                <p className="text-muted-foreground">
                  HVI (por manzana): <span className="font-medium text-foreground">{props.hvi.toFixed(2)}</span>
                  {" · "}
                  Amenaza del casco urbano:{" "}
                  <span className="font-medium text-foreground">{props.compoundLevel ?? "—"}</span>
                </p>
              </div>
              <p className="border-t border-border pt-1.5 leading-snug text-muted-foreground">{HVI_EXPLAINER.what}</p>
            </div>
          ),
        })
      }
    },
    [vulnerabilidadData],
  )

  const syncBounds = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map || !onBoundsChange) return
    const b = map.getBounds()
    onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
  }, [onBoundsChange])

  return (
    <div className={cn("relative", className)}>
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={{ bounds: AOI_BOUNDS, pitch: 55, bearing: -12 }}
        attributionControl={false}
        cursor={cursor}
        interactiveLayerIds={interactiveLayerIds}
        onLoad={syncBounds}
        onMoveEnd={syncBounds}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-left" />
        <MapViewToggleControl is3D={is3D} onToggle={() => setMapPitch(!is3D)} />
        <MapBasemapControl basemap={basemap} onChange={setBasemap} />
        <AttributionControl position="bottom-left" customAttribution="MapLibre © OpenStreetMap / CARTO — DANE" compact />

        {indicator === "pobreza" && levelColors && (
          <Source id="pobreza-source" type="geojson" data={pobrezaGeoJson}>
            <Layer
              id="pobreza-columns"
              type="fill-extrusion"
              paint={{
                "fill-extrusion-height": ["get", "__height"],
                "fill-extrusion-base": 0,
                "fill-extrusion-color": ["get", "__color"],
                "fill-extrusion-opacity": 0.88,
              }}
            />
          </Source>
        )}

        {indicator === "manzanas" && levelColors && (
          <Source id="manzanas-source" type="geojson" data={manzanasGeoJson}>
            <Layer
              id="manzanas-columns"
              type="fill-extrusion"
              paint={{
                "fill-extrusion-height": ["get", "__height"],
                "fill-extrusion-base": 0,
                "fill-extrusion-color": ["get", "__color"],
                "fill-extrusion-opacity": 0.88,
              }}
            />
          </Source>
        )}

        {indicator === "vulnerabilidad" && vulnColors && (
          <Source id="vulnerabilidad-source" type="geojson" data={vulnerabilidadGeoJson}>
            <Layer
              id="vulnerabilidad-columns"
              type="fill-extrusion"
              paint={{
                "fill-extrusion-height": ["get", "__height"],
                "fill-extrusion-base": 0,
                "fill-extrusion-color": ["get", "__color"],
                "fill-extrusion-opacity": 0.88,
              }}
            />
          </Source>
        )}

        {indicator === "vulnerabilidad" && vulnColors && (
          <Source id="vulnerabilidad-manzanas-source" type="geojson" data={vulnerabilidadManzanasGeoJson}>
            <Layer
              id="vulnerabilidad-manzanas-columns"
              type="fill-extrusion"
              paint={{
                "fill-extrusion-height": ["get", "__height"],
                "fill-extrusion-base": 0,
                "fill-extrusion-color": ["get", "__color"],
                "fill-extrusion-opacity": 0.88,
              }}
            />
          </Source>
        )}

        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            className="z-[500]"
          >
            {popupInfo.content}
          </Popup>
        )}
      </Map>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-sm:hidden">
        {indicator === "vulnerabilidad" ? (
          <VulnerabilityLegend />
        ) : (
          <IndicatorLegend
            title={indicator === "pobreza" ? "Pobreza multidimensional (IPM)" : MANZANA_FIELD_LABEL[manzanaField]}
          />
        )}
      </div>

      <MapControlRail>
        <RailSection title="Indicador" first>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 rounded-sm px-1.5 py-1 -mx-1.5 font-medium text-foreground transition-colors hover:bg-muted/70">
              <input
                type="radio"
                name="demografia-indicator"
                checked={indicator === "pobreza"}
                onChange={() => setIndicator("pobreza")}
                className="size-3.5 shrink-0 accent-primary"
              />
              <span className="text-pretty">Pobreza multidimensional</span>
            </label>
            <label className="flex items-center gap-2 rounded-sm px-1.5 py-1 -mx-1.5 font-medium text-foreground transition-colors hover:bg-muted/70">
              <input
                type="radio"
                name="demografia-indicator"
                checked={indicator === "manzanas"}
                onChange={() => setIndicator("manzanas")}
                className="size-3.5 shrink-0 accent-primary"
              />
              <span className="text-pretty">Viviendas, hogares y personas</span>
            </label>
            <label className="flex items-center gap-2 rounded-sm px-1.5 py-1 -mx-1.5 font-medium text-foreground transition-colors hover:bg-muted/70">
              <input
                type="radio"
                name="demografia-indicator"
                checked={indicator === "vulnerabilidad"}
                onChange={() => setIndicator("vulnerabilidad")}
                className="size-3.5 shrink-0 accent-primary"
              />
              <TriangleAlert className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-pretty">Índice de vulnerabilidad compuesto</span>
            </label>
          </div>
        </RailSection>

        {indicator === "manzanas" && (
          <RailSection title="Variable de extrusión">
            <div className="flex flex-col gap-1">
              {(Object.keys(MANZANA_FIELD_LABEL) as ManzanaField[]).map((field) => {
                const Icon = MANZANA_FIELD_ICON[field]
                return (
                  <label
                    key={field}
                    className="flex items-center gap-2 rounded-sm px-1.5 py-1 -mx-1.5 font-medium text-foreground transition-colors hover:bg-muted/70"
                  >
                    <input
                      type="radio"
                      name="demografia-manzana-field"
                      checked={manzanaField === field}
                      onChange={() => setManzanaField(field)}
                      className="size-3.5 shrink-0 accent-primary"
                    />
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-pretty">{MANZANA_FIELD_LABEL[field]}</span>
                  </label>
                )
              })}
            </div>
          </RailSection>
        )}

        <RailSection title="Fuente">
          <p className="text-muted-foreground">
            {indicator === "vulnerabilidad"
              ? "HVI por manzana en cascos urbanos, por municipio en veredas rurales (DANE) × riesgo compuesto por vereda (este mismo sitio). Cada manzana o vereda se colorea con su propio valor — nunca un promedio único para todo el municipio."
              : "DANE — Geoportal (IPM 2018 y Censo Nacional de Población y Vivienda 2018)."}
          </p>
        </RailSection>
      </MapControlRail>
    </div>
  )
}

export function DemografiaLiveMap(props: {
  onBoundsChange?: (bounds: MapBounds) => void
  className?: string
}) {
  return <DemografiaLiveMapImpl {...props} />
}
