"use client"

import { useRef, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { tokenColor } from "@/lib/utils"
import { WeatherDetailedForecast, WeatherReportCard } from "@/components/clima/weather-report-card"
import { useSismologiaEventos } from "@/lib/sismologia/use-sismologia"
import { formatQuakeAge, getLatestSeismicEvents } from "@/lib/sismologia/latest-events"
import { MIN_NUMBERED_MAGNITUDE } from "@/lib/sismologia/levels"
import { formatDateTime } from "@/lib/firms/ui"
import type { ClimaVeredaProperties } from "@/lib/clima/api-types"
import { LAYER_DEFINITIONS, type LabVeredasFeatureCollection, type LayerKey } from "@/lib/laboratorio/layers"
import type { VeredaFeature } from "@/lib/veredas/api-types"
import { LiveThreatPopulation } from "@/components/deslizamientos/live-threat-population"
import { HazardModelPanel } from "@/components/deslizamientos/hazard-model-panel"
import { MunicipioFloodSummary } from "@/components/inundaciones/municipio-flood-summary"
import { FloodOverview } from "@/components/inundaciones/flood-overview"
import { FloodModelPanel } from "@/components/inundaciones/flood-model-panel"
import { FireOverview } from "@/components/incendios/fire-overview"
import { FireModelPanel } from "@/components/incendios/fire-model-panel"
import { SismologiaOverview } from "@/components/sismologia/sismologia-overview"
import { PrecipitationOverview } from "@/components/precipitacion/precipitation-overview"
import { DecadalChart as PrecipDecadalChart } from "@/components/precipitacion/decadal-chart"
import { QuinquenalChart as PrecipQuinquenalChart } from "@/components/precipitacion/quinquenal-chart"
import { DecadalChart as ClimaDecadalChart } from "@/components/clima/decadal-chart"
import { QuinquenalChart as ClimaQuinquenalChart } from "@/components/clima/quinquenal-chart"

interface BottomTabsProps {
  veredas: LabVeredasFeatureCollection | null
  activeLayers: LayerKey[]
  /** Last layer turned on — the "panel de análisis" always focuses on this one, same as the context panel's legend. */
  lastActivatedLayer: LayerKey | null
  selectedVereda: VeredaFeature | null
  /** Weather report for the clicked vereda, or the casco urbano of the selected municipio by default. */
  climaVereda: ClimaVeredaProperties | null
  onClearSelection: () => void
  onFlyTo: (target: { lon: number; lat: number; zoom: number }) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /** Desktop-only expanded height, as a percentage of the map area. Mobile always uses a fixed height. */
  height: number
  onHeightChange: (height: number) => void
}

export const DEFAULT_BOTTOM_PANEL_HEIGHT = 42
const MIN_PANEL_HEIGHT = 20
const MAX_PANEL_HEIGHT = 85
const KEYBOARD_STEP = 5
const DRAG_THRESHOLD_PX = 4

function clampHeight(value: number) {
  return Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, Math.round(value * 10) / 10))
}

/** Narrows `VeredaFeature` to the `{ codigoVereda, nombre, municipio }` shape the clima/precipitación charts expect. */
function toSelectedVereda(feature: VeredaFeature | null) {
  if (!feature) return null
  return {
    codigoVereda: feature.properties.codigoVereda,
    nombre: feature.properties.nombre,
    municipio: feature.properties.municipio,
  }
}

const METHODOLOGY_NOTES: Partial<Record<LayerKey, string>> = {
  deslizamientos:
    "Modelo propio: pendiente del terreno + proximidad a vías + anomalía de lluvia antecedente sobre su línea base de 3 años, por vereda. Ver lib/deslizamientos/hazard-model.ts — sin cambios en este prototipo.",
  inundaciones:
    "Combina la zonificación oficial + proximidad a cuerpos de agua + planitud del terreno. Ver lib/inundaciones/hazard-model.ts — sin cambios en este prototipo.",
  incendios:
    "Pendiente y proximidad a vías (reutilizados del modelo de deslizamientos) + recurrencia histórica de focos NASA FIRMS + Índice de Peligro de Incendio (FWI) del día. Ver lib/incendios/hazard-model.ts — sin cambios en este prototipo.",
  "riesgo-compuesto":
    "Combina el nivel más severo entre deslizamientos, inundaciones e incendios por vereda (\"el peor gana\"). Ver lib/riesgo-compuesto — sin cambios en este prototipo.",
  precipitacion:
    "Precipitación acumulada o pronosticada por vereda (Open-Meteo / IDEAM). Ver lib/precipitacion/hazard-model.ts — sin cambios en este prototipo.",
  clima: "Temperatura actual y climatología histórica por vereda (Open-Meteo). Ver lib/clima/api-types.ts — sin cambios en este prototipo.",
  demografia:
    "Vista simplificada por vereda: normaliza la población de /api/veredas en 5 niveles. No es el IVS/vulnerabilidad completo de producción (que trabaja a nivel de manzana) — esa profundidad queda fuera de este prototipo.",
  sismologia:
    "Eventos sísmicos recientes combinados del Servicio Geológico Colombiano y USGS, sin restricción geográfica — los epicentros pueden caer fuera de cualquier municipio del área de estudio. Ver lib/sismologia — sin cambios en este prototipo.",
  hidrantes:
    "Inventario estático de fuentes hídricas del casco urbano de Sevilla. Solo se muestran los primeros puntos cercanos al centro; el resto está en \"ver todas\". Sin modelo de amenaza asociado.",
}

/**
 * Floating, collapsible bottom card docked above the map's bottom edge. It
 * always focuses on `lastActivatedLayer` (same convention as the right
 * context panel) and mounts that category's *real* production components —
 * the same ones under the fold on `/`, imported as-is — instead of a
 * synthetic reimplementation, so every chart/table/methodology note a
 * viewer would see on the dedicated page is also reachable here.
 */
export function BottomTabs({
  veredas,
  activeLayers,
  lastActivatedLayer,
  selectedVereda,
  climaVereda,
  onClearSelection,
  onFlyTo,
  collapsed,
  onCollapsedChange,
  height,
  onHeightChange,
}: BottomTabsProps) {
  const focusLayer = lastActivatedLayer && activeLayers.includes(lastActivatedLayer)
    ? lastActivatedLayer
    : activeLayers[activeLayers.length - 1] ?? null

  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startPx: number; containerPx: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const panel = panelRef.current
    const container = panel?.parentElement
    if (!panel || !container) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startY: event.clientY,
      startPx: panel.offsetHeight,
      containerPx: container.clientHeight,
      moved: false,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const delta = drag.startY - event.clientY
    if (!drag.moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return
    drag.moved = true
    setDragging(true)
    if (collapsed) {
      if (delta <= 0) return
      onCollapsedChange(false)
    }
    onHeightChange(clampHeight(((drag.startPx + delta) / drag.containerPx) * 100))
  }

  const endDrag = (toggleIfClick: boolean) => {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (drag && !drag.moved && toggleIfClick) onCollapsedChange(!collapsed)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (collapsed) onCollapsedChange(false)
      else onHeightChange(clampHeight(height + KEYBOARD_STEP))
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!collapsed) onHeightChange(clampHeight(height - KEYBOARD_STEP))
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onCollapsedChange(!collapsed)
    }
  }

  return (
    <div
      ref={panelRef}
      style={{ "--bottom-panel-h": `${height}%` } as React.CSSProperties}
      className={`absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-md ${
        dragging ? "" : "transition-[height]"
      } ${collapsed ? "h-11" : "h-[46%] sm:h-[var(--bottom-panel-h)]"}`}
    >
      <div className="relative flex h-11 items-center justify-between border-b border-border/70 px-4 sm:h-9">
        <p className="max-w-[38%] truncate text-xs font-medium text-muted-foreground sm:max-w-none">
          {focusLayer ? `Panel de análisis · ${LAYER_DEFINITIONS[focusLayer].label}` : "Panel de análisis"}
        </p>

        <Button
          type="button"
          variant="secondary"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expandir panel" : "Colapsar panel"}
          aria-expanded={!collapsed}
          className="absolute left-1/2 top-1/2 h-9 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-muted shadow-sm sm:hidden"
        >
          {collapsed ? <ChevronUp className="size-6" aria-hidden="true" /> : <ChevronDown className="size-6" aria-hidden="true" />}
        </Button>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Redimensionar panel de análisis. Arrastra o usa las flechas arriba y abajo."
          aria-valuemin={MIN_PANEL_HEIGHT}
          aria-valuemax={MAX_PANEL_HEIGHT}
          aria-valuenow={collapsed ? 0 : Math.round(height)}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => onHeightChange(DEFAULT_BOTTOM_PANEL_HEIGHT)}
          title="Arrastra para cambiar el tamaño · doble clic para restablecer"
          className="group absolute left-1/2 top-0 hidden h-full w-48 -translate-x-1/2 cursor-row-resize touch-none items-center justify-center focus-visible:outline-2 focus-visible:outline-ring sm:flex"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-14 rounded-full bg-muted-foreground/40 transition-colors group-hover:bg-muted-foreground/80 group-focus-visible:bg-muted-foreground/80 ${
              dragging ? "bg-primary" : ""
            }`}
          />
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="hidden size-6 shrink-0 sm:inline-flex"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expandir panel" : "Colapsar panel"}
        >
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="h-[calc(100%-2.75rem)] overflow-y-auto p-3 sm:h-[calc(100%-2.25rem)] sm:p-4">
          {!focusLayer ? (
            <p className="text-sm text-muted-foreground">
              Activa una capa en el riel izquierdo para ver sus gráficos, métricas y metodología.
            </p>
          ) : (
            <Tabs defaultValue="panel" key={focusLayer} className="mx-auto w-full max-w-[110rem] @container">
              <TabsList>
                <TabsTrigger value="panel">Panel</TabsTrigger>
                <TabsTrigger value="metodologia">Metodología</TabsTrigger>
              </TabsList>

              <TabsContent value="panel" className="pt-3">
                <FocusedLayerPanel
                  layer={focusLayer}
                  veredas={veredas}
                  selectedVereda={selectedVereda}
                  climaVereda={climaVereda}
                  onClearSelection={onClearSelection}
                  onFlyTo={onFlyTo}
                />
              </TabsContent>

              <TabsContent value="metodologia" className="pt-3">
                <div className="max-w-3xl rounded-md border border-border p-3 text-sm">
                  <p className="font-medium text-foreground">{LAYER_DEFINITIONS[focusLayer].label}</p>
                  <p className="text-muted-foreground">
                    {METHODOLOGY_NOTES[focusLayer] ?? "Sin nota de metodología para esta capa."}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </div>
  )
}

function FocusedLayerPanel({
  layer,
  veredas,
  selectedVereda,
  climaVereda,
  onClearSelection,
  onFlyTo,
}: {
  layer: LayerKey
  veredas: LabVeredasFeatureCollection | null
  selectedVereda: VeredaFeature | null
  climaVereda: ClimaVeredaProperties | null
  onClearSelection: () => void
  onFlyTo: (target: { lon: number; lat: number; zoom: number }) => void
}) {
  switch (layer) {
    case "deslizamientos":
      return (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
          <LiveThreatPopulation />
          <HazardModelPanel selectedVereda={selectedVereda} onClearSelection={onClearSelection} />
        </div>
      )
    case "inundaciones":
      return (
        <div className="flex flex-col gap-4">
          <MunicipioFloodSummary />
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
            <FloodOverview />
            <FloodModelPanel selectedVereda={selectedVereda} onClearSelection={onClearSelection} />
          </div>
        </div>
      )
    case "incendios":
      return (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
          <FireOverview />
          <FireModelPanel selectedVereda={selectedVereda} onClearSelection={onClearSelection} />
        </div>
      )
    case "precipitacion": {
      const vereda = toSelectedVereda(selectedVereda)
      return (
        <div className="flex flex-col gap-4">
          <PrecipitationOverview />
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
            <PrecipDecadalChart vereda={vereda} />
            <PrecipQuinquenalChart vereda={vereda} />
          </div>
        </div>
      )
    }
    case "clima": {
      const vereda = toSelectedVereda(selectedVereda)
      return (
        <div className="flex flex-col gap-4">
          <WeatherDetailedForecast vereda={climaVereda} />
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
            <WeatherReportCard vereda={climaVereda} />
            <ClimaDecadalChart vereda={vereda} />
            <ClimaQuinquenalChart vereda={vereda} />
          </div>
        </div>
      )
    }
    case "sismologia":
      return (
        <div className="flex flex-col gap-4">
          <LatestQuakes onFlyTo={onFlyTo} />
          <SismologiaOverview />
        </div>
      )
    case "hidrantes":
      return (
        <p className="mx-auto max-w-xl text-center text-sm text-muted-foreground">
          Los hidrantes no tienen identificación individual en campo, por lo que no se listan aquí. Usa el mapa o el
          botón "Ver todas" para ubicar el más cercano.
        </p>
      )
    case "riesgo-compuesto":
      return (
        <p className="mx-auto max-w-md text-center text-sm text-muted-foreground">
          El resumen de riesgo compuesto vive en el panel derecho (veredas ordenadas por su amenaza más
          severa) — no tiene un panel propio independiente en producción más allá de ese.
        </p>
      )
    case "demografia":
      return <DemografiaSummary veredas={veredas} />
    default:
      return null
  }
}

function LatestQuakes({ onFlyTo }: { onFlyTo: (target: { lon: number; lat: number; zoom: number }) => void }) {
  const { data } = useSismologiaEventos()
  const latest = getLatestSeismicEvents(data, 3)

  return (
    <section aria-label="Últimos tres sismos" className="rounded-md border border-border p-3">
      <h3 className="mb-2 text-sm font-medium text-foreground">
        Últimos tres sismos <span className="font-normal text-muted-foreground">(M ≥ {MIN_NUMBERED_MAGNITUDE})</span>
      </h3>
      {latest.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cargando eventos recientes…</p>
      ) : (
        <ol className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
          {latest.map((quake, i) => (
            <li key={quake.id}>
              <button
                type="button"
                onClick={() => onFlyTo({ lon: quake.lon, lat: quake.lat, zoom: 8 })}
                className="flex w-full items-center gap-3 rounded-md border border-border bg-background/50 p-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full bg-destructive font-bold text-destructive-foreground ${i === 0 ? "size-9 text-sm" : "size-7 text-xs"}`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    M {Number(quake.magnitude).toFixed(1)} · {formatQuakeAge(quake.time)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {quake.place ?? formatDateTime(quake.time)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function DemografiaSummary({ veredas }: { veredas: LabVeredasFeatureCollection | null }) {
  const def = LAYER_DEFINITIONS.demografia
  const levels = def.levels ?? []
  const counts = levels.map((level) => ({
    level,
    style: def.levelStyles?.[level],
    count: veredas?.features.filter((f) => f.properties.demografiaLevel === level).length ?? 0,
  }))
  const max = Math.max(1, ...counts.map((c) => c.count))

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-md border border-border p-3 mx-auto">
      <p className="text-sm font-medium text-foreground">Población por vereda (5 niveles)</p>
      <div className="flex h-24 items-end gap-1.5">
        {counts.map(({ level, style, count }) => (
          <div key={level} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${Math.max(4, (count / max) * 100)}%`,
                backgroundColor: style ? tokenColor(style.colorToken) : undefined,
              }}
              title={`${level}: ${count}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
