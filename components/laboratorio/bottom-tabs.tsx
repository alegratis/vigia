"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { WeatherReportCard } from "@/components/clima/weather-report-card"
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
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
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
    "Precipitación acumulada o pronosticada por vereda (NASA POWER / Open-Meteo). Ver lib/precipitacion/hazard-model.ts — sin cambios en este prototipo.",
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
  collapsed,
  onCollapsedChange,
}: BottomTabsProps) {
  const focusLayer = lastActivatedLayer && activeLayers.includes(lastActivatedLayer)
    ? lastActivatedLayer
    : activeLayers[activeLayers.length - 1] ?? null

  return (
    <div
      className={`absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-md transition-[height] ${collapsed ? "h-11" : "h-[46%] sm:h-[42%]"}`}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-1.5">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {focusLayer ? `Panel de análisis · ${LAYER_DEFINITIONS[focusLayer].label}` : "Panel de análisis"}
        </p>
        <Button
          size="icon"
          variant="ghost"
          className="size-6 shrink-0"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expandir panel" : "Colapsar panel"}
        >
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>

      {!collapsed && (
        <div className="h-[calc(100%-2.25rem)] overflow-y-auto p-3 sm:p-4">
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
}: {
  layer: LayerKey
  veredas: LabVeredasFeatureCollection | null
  selectedVereda: VeredaFeature | null
  climaVereda: ClimaVeredaProperties | null
  onClearSelection: () => void
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
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
          <WeatherReportCard vereda={climaVereda} />
          <ClimaDecadalChart vereda={vereda} />
          <ClimaQuinquenalChart vereda={vereda} />
        </div>
      )
    }
    case "sismologia":
      return <SismologiaOverview />
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
                backgroundColor: style ? `var(--${style.colorToken})` : undefined,
              }}
              title={`${level}: ${count}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
