"use client"

import Image from "next/image"
import { Layers, LocateFixed, Navigation, PanelRightClose, PanelRightOpen, Route, TriangleAlert, X } from "lucide-react"
import {
  LAYER_DEFINITIONS,
  levelSeverity,
  resolveOption,
  resolveSubLayerOn,
  type LabVeredasFeatureCollection,
  type LayerKey,
} from "@/lib/laboratorio/layers"
import {
  formatHidranteDistance,
  type HidrantesExperience,
} from "@/lib/laboratorio/use-hidrantes-experience"
import {
  MANZANA_FIELD_LABEL,
  type DemografiaExperience,
  type DemografiaIndicator,
  type ManzanaField,
} from "@/lib/laboratorio/use-demografia-experience"
import { INDICATOR_LEVELS } from "@/lib/demografia/indicator-levels"
import { VULNERABILITY_LEVELS, VULNERABILITY_LEVEL_STYLES } from "@/lib/vulnerabilidad/levels"
import { CONFIDENCE_STYLES } from "@/lib/firms/ui"
import { SENSITIVE_SITE_STYLES } from "@/lib/osm/sensitive-sites"
import {
  SEISMIC_EXPOSURE_LEVELS,
  SEISMIC_EXPOSURE_LEVEL_TOKENS,
  SEISMIC_MAGNITUDE_LEVELS,
  SEISMIC_MAGNITUDE_LEVEL_STYLES,
} from "@/lib/sismologia/levels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ContextPanelProps {
  veredas: LabVeredasFeatureCollection | null
  activeLayers: LayerKey[]
  /** Last layer turned on — drives which legend/metrics show when several are active. */
  lastActivatedLayer: LayerKey | null
  previewLayer: LayerKey | null
  /** Per-sub-layer on/off overrides for whichever layer is currently focused — see `resolveSubLayerOn`. */
  subLayerToggles: Record<string, boolean>
  onToggleSubLayer: (id: string) => void
  /** Whether the bottom analysis panel is collapsed — this panel shrinks to match so the two never overlap. */
  bottomPanelCollapsed: boolean
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /** Selected value per `LayerOption` id — see `resolveOption`. */
  optionValues: Record<string, string>
  onOptionChange: (id: string, value: string) => void
  /** Geolocation/routing/coverage state for the hidrantes layer — see `lab-map.tsx` for the matching rendering. */
  hidrantesExperience: HidrantesExperience
  /** Indicator-switching state for the demografía layer — see `lab-map.tsx` for the matching rendering. */
  demografiaExperience: DemografiaExperience
}

/**
 * Floating right-side contextual card: shows a compound "most severe hazard
 * wins" summary when no layer is active, the hovered-but-off layer's
 * thumbnail + affected-vereda count during a rail hover preview, or the
 * most-recently-activated active layer's legend + per-level vereda counts
 * (plus its "Capas" context-overlay checklist) otherwise. Its height tracks
 * `bottomPanelCollapsed` so it never overlaps the floating bottom panel in
 * the bottom-right corner.
 */
export function ContextPanel({
  veredas,
  activeLayers,
  lastActivatedLayer,
  previewLayer,
  subLayerToggles,
  onToggleSubLayer,
  bottomPanelCollapsed,
  collapsed,
  onCollapsedChange,
  hidrantesExperience,
  demografiaExperience,
  optionValues,
  onOptionChange,
}: ContextPanelProps) {
  const focusLayer =
    lastActivatedLayer && activeLayers.includes(lastActivatedLayer)
      ? lastActivatedLayer
      : activeLayers[activeLayers.length - 1] ?? null

  const content = previewLayer ? (
    <PreviewSummary veredas={veredas} layer={previewLayer} />
  ) : activeLayers.length === 0 ? (
    <CompoundSummary veredas={veredas} />
  ) : focusLayer === "hidrantes" ? (
    <HidrantesPanel experience={hidrantesExperience} />
  ) : focusLayer === "demografia" ? (
    <DemografiaPanel experience={demografiaExperience} />
  ) : focusLayer === "sismologia" ? (
    <SismologiaLegend subLayerToggles={subLayerToggles} />
  ) : (
    <>
      <LayerLegend veredas={veredas} layer={focusLayer!} activeLayers={activeLayers} />
      {focusLayer === "incendios" && <FocosLegend />}
      {focusLayer === "clima" && <ClimaMarkersLegend />}
    </>
  )

  const subLayers = !previewLayer && focusLayer ? LAYER_DEFINITIONS[focusLayer].subLayers : undefined

  if (collapsed) {
    return (
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={() => onCollapsedChange(false)}
        aria-label="Mostrar panel de información"
        aria-expanded={false}
        className="absolute right-3 top-3 z-10 size-9 border border-border/60 bg-card/80 shadow-lg backdrop-blur-md"
      >
        <PanelRightOpen className="size-4" aria-hidden="true" />
      </Button>
    )
  }

  return (
    <div
      className={`absolute right-3 top-3 z-10 flex w-[min(18rem,calc(100vw-5.5rem))] flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-md transition-[bottom] ${
        bottomPanelCollapsed ? "bottom-[4.25rem]" : "bottom-[calc(42%+1.5rem)]"
      }`}
    >
      <div className="flex shrink-0 items-center justify-end border-b border-border/70 px-2 py-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => onCollapsedChange(true)}
          aria-label="Ocultar panel de información"
          aria-expanded
        >
          <PanelRightClose className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      {subLayers && subLayers.length > 0 && (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-border/70 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Layers className="size-3.5" aria-hidden="true" />
            Capas
          </p>
          <ul className="flex flex-col gap-2">
            {subLayers.map((sub) => {
              const checked = resolveSubLayerOn(focusLayer!, sub.id, subLayerToggles)
              const option = sub.optionId
                ? LAYER_DEFINITIONS[focusLayer!].options?.find((o) => o.id === sub.optionId)
                : undefined
              return (
                <li key={sub.id} className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={`sublayer-${sub.id}`}
                      checked={checked}
                      onCheckedChange={() => onToggleSubLayer(sub.id)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`sublayer-${sub.id}`} className="text-xs font-normal leading-snug text-foreground">
                      {sub.label}
                    </Label>
                  </div>
                  {checked && option && (
                    <div className="ml-6 flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">{option.label}</span>
                      <Select
                        value={resolveOption(focusLayer!, option.id, optionValues)}
                        onValueChange={(value) => value && onOptionChange(option.id, value)}
                      >
                        <SelectTrigger className="h-7 text-xs" aria-label={option.label}>
                          <SelectValue>
                            {(value: string | null) => option.choices.find((c) => c.value === value)?.label ?? value}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {option.choices.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function PreviewSummary({ veredas, layer }: { veredas: LabVeredasFeatureCollection | null; layer: LayerKey }) {
  const def = LAYER_DEFINITIONS[layer]
  // "points" layers (sismologia, hidrantes) have no levelProperty — their preview has no per-vereda count to show.
  const count = def.levelProperty ? veredas?.features.filter((f) => f.properties[def.levelProperty!]).length ?? 0 : 0

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border">
        <Image src={def.image || "/placeholder.svg"} alt={def.imageAlt} fill className="object-cover" />
      </div>
      <div>
        <p className="font-medium text-foreground">{def.label}</p>
        <p className="text-sm text-muted-foreground">{count} veredas con dato de esta capa</p>
      </div>
      <p className="text-xs text-muted-foreground">Clic en el riel para activarla sobre el mapa.</p>
    </div>
  )
}

function CompoundSummary({ veredas }: { veredas: LabVeredasFeatureCollection | null }) {
  if (!veredas) {
    return <p className="p-4 text-sm text-muted-foreground">Cargando datos de veredas…</p>
  }

  const layers: LayerKey[] = ["deslizamientos", "inundaciones", "incendios"]
  const ranked = veredas.features
    .map((feature) => {
      let worst = -1
      let worstLayer: LayerKey | null = null
      for (const layer of layers) {
        const def = LAYER_DEFINITIONS[layer]
        // These three layers are always "fill" mode, so levelProperty is always defined.
        const level = (def.levelProperty ? feature.properties[def.levelProperty] : null) as string | null
        const severity = levelSeverity(layer, level)
        if (severity > worst) {
          worst = severity
          worstLayer = layer
        }
      }
      return { feature, worst, worstLayer }
    })
    .filter((entry) => entry.worst >= 0)
    .sort((a, b) => b.worst - a.worst)
    .slice(0, 8)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium text-foreground">Riesgo compuesto</p>
        <p className="text-sm text-muted-foreground">
          Ninguna capa activa — veredas ordenadas por su amenaza más severa entre las 3 capas disponibles.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {ranked.map(({ feature, worstLayer }) => (
          <li key={feature.properties.codigoVereda} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{feature.properties.nombre}</span>
            {worstLayer && (
              <Badge variant="secondary" className="shrink-0">
                {LAYER_DEFINITIONS[worstLayer].shortLabel}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function HidrantesPanel({ experience }: { experience: HidrantesExperience }) {
  const {
    geoStatus,
    requestLocation,
    referencePoint,
    nearestByDistance,
    nearestByRouteIndex,
    sameNearest,
    distanceRoute,
    routeRoute,
    selectedFeature,
    selectedRoute,
    setSelectedIndex,
    showCoverage,
    setShowCoverage,
    hidrantesError,
  } = experience

  const statusLabel: Record<typeof geoStatus, string> = {
    idle: "",
    loading: "Buscando tu ubicación…",
    granted: "Ubicación activa",
    denied: "Ubicación denegada — toca el mapa para elegir un punto",
    unsupported: "Tu navegador no soporta geolocalización — toca el mapa para elegir un punto",
    fuera: "Estás fuera de Sevilla — toca el mapa para elegir un punto dentro del casco urbano",
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium text-foreground">Hidrantes — Sevilla</p>
        <p className="text-xs text-muted-foreground">{statusLabel[geoStatus]}</p>
      </div>

      {hidrantesError && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          No se pudo cargar la capa de hidrantes.
        </p>
      )}

      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={requestLocation}
        disabled={geoStatus === "loading"}
        className="w-fit"
      >
        <LocateFixed className="size-3.5" aria-hidden="true" />
        {geoStatus === "granted" ? "Actualizar mi ubicación" : "Usar mi ubicación"}
      </Button>

      {referencePoint && selectedFeature && selectedRoute ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border/70 bg-muted/40 p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-foreground">Hidrante seleccionado</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-5"
              onClick={() => setSelectedIndex(null)}
              aria-label="Quitar selección"
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Route className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
            {formatHidranteDistance(selectedRoute.distanceM)}
            {!selectedRoute.followsStreets && " (línea recta)"}
          </p>
        </div>
      ) : referencePoint && nearestByDistance ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border/70 bg-muted/40 p-2.5 text-sm">
          <p className="flex items-center gap-1.5 text-foreground">
            <Navigation className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden="true" />
            Más cercano:{" "}
            {distanceRoute
              ? formatHidranteDistance(distanceRoute.distanceM)
              : `${formatHidranteDistance(nearestByDistance.distanceKm * 1000)} (línea recta)`}
          </p>
          {!sameNearest && nearestByRouteIndex != null && routeRoute && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Route className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden="true" />
              Más rápido a pie: {formatHidranteDistance(routeRoute.distanceM)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Toca un hidrante en el mapa para trazar su ruta.</p>
        </div>
      ) : null}

      <div className="flex items-start gap-2">
        <Checkbox id="hidrantes-coverage" checked={showCoverage} onCheckedChange={(v) => setShowCoverage(v === true)} />
        <Label htmlFor="hidrantes-coverage" className="text-xs font-normal leading-snug text-foreground">
          Mostrar cobertura y zonas desatendidas
        </Label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sitios sensibles cercanos</p>
        <ul className="flex flex-col gap-1">
          {SENSITIVE_SITE_STYLES.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
              <span className="text-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const INDICATOR_OPTIONS: { value: DemografiaIndicator; label: string }[] = [
  { value: "vulnerabilidad", label: "Vulnerabilidad compuesta" },
  { value: "pobreza", label: "Pobreza multidimensional" },
  { value: "manzanas", label: "Manzanas" },
]

function DemografiaPanel({ experience }: { experience: DemografiaExperience }) {
  const { indicator, setIndicator, manzanaField, setManzanaField, isLoading, error } = experience

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium text-foreground">Demografía — Sevilla</p>
        <p className="text-xs text-muted-foreground">Columnas 3D por manzana/vereda, según el indicador elegido.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        {INDICATOR_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={indicator === opt.value ? "default" : "secondary"}
            className="justify-start"
            onClick={() => setIndicator(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {indicator === "manzanas" && (
        <div className="flex gap-1.5">
          {(Object.keys(MANZANA_FIELD_LABEL) as ManzanaField[]).map((field) => (
            <Button
              key={field}
              type="button"
              size="sm"
              variant={manzanaField === field ? "default" : "outline"}
              className="flex-1"
              onClick={() => setManzanaField(field)}
            >
              {MANZANA_FIELD_LABEL[field]}
            </Button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Cargando datos del geoportal…</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          No se pudo cargar este indicador.
        </p>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Leyenda</p>
        <ul className="flex flex-col gap-1.5">
          {indicator === "vulnerabilidad"
            ? VULNERABILITY_LEVELS.map((level) => (
                <li key={level} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn("size-2.5 shrink-0 rounded-sm", VULNERABILITY_LEVEL_STYLES[level].swatchClass)}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{level}</span>
                </li>
              ))
            : INDICATOR_LEVELS.map((level) => (
                <li key={level} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: `var(--demografia-indicador-${slugifyLevel(level)})` }}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{level}</span>
                </li>
              ))}
        </ul>
      </div>
    </div>
  )
}

function slugifyLevel(level: string): string {
  return level
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
}

function LayerLegend({
  veredas,
  layer,
  activeLayers,
}: {
  veredas: LabVeredasFeatureCollection | null
  layer: LayerKey
  activeLayers: LayerKey[]
}) {
  const def = LAYER_DEFINITIONS[layer]
  // `LayerLegend` only ever receives "fill" mode layers (see `lastActivatedLayer` usage in the parent),
  // so `levels`/`levelStyles`/`levelProperty` are always defined here.
  const levels = def.levels ?? []
  const levelStyles = def.levelStyles ?? {}
  const levelProperty = def.levelProperty
  const counts = levels.map((level) => ({
    level,
    style: levelStyles[level],
    count: veredas?.features.filter((f) => levelProperty && f.properties[levelProperty] === level).length ?? 0,
  }))

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium text-foreground">{def.label}</p>
        {activeLayers.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {activeLayers.length} capas activas — mostrando la última activada
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {counts.map(({ level, style, count }) => (
          <li key={level} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: style ? `var(--${style.colorToken})` : undefined }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-foreground">{level}</span>
            <span className="text-muted-foreground">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LegendSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/70 px-4 py-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  )
}

function LegendRow({ color, label, hint, round }: { color: string; label: string; hint?: string; round?: boolean }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={cn("size-2.5 shrink-0", round ? "rounded-full" : "rounded-sm")}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="flex-1 truncate text-foreground">{label}</span>
      {hint && <span className="text-muted-foreground">{hint}</span>}
    </li>
  )
}

function SismologiaLegend({ subLayerToggles }: { subLayerToggles: Record<string, boolean> }) {
  const showFaults = resolveSubLayerOn("sismologia", "faults", subLayerToggles)
  const showExposure = resolveSubLayerOn("sismologia", "sismo-veredas", subLayerToggles)
  return (
    <div className="flex flex-col">
      <div className="p-4 pb-3">
        <p className="font-medium text-foreground">Sismología</p>
        <p className="text-xs text-muted-foreground">El tamaño del círculo crece con la magnitud.</p>
      </div>
      <LegendSection title="Magnitud del sismo">
        {SEISMIC_MAGNITUDE_LEVELS.map((level) => (
          <LegendRow
            key={level}
            round
            color={SEISMIC_MAGNITUDE_LEVEL_STYLES[level].colorToken}
            label={level}
            hint={SEISMIC_MAGNITUDE_LEVEL_STYLES[level].range}
          />
        ))}
      </LegendSection>
      {showExposure && (
        <LegendSection title="Exposición sísmica por vereda">
          {SEISMIC_EXPOSURE_LEVELS.map((level) => (
            <LegendRow key={level} color={SEISMIC_EXPOSURE_LEVEL_TOKENS[level]} label={level} />
          ))}
        </LegendSection>
      )}
      {showFaults && (
        <LegendSection title="Fallas geológicas">
          <li className="flex items-center gap-2 text-xs">
            <span className="h-0 w-5 shrink-0 border-t-2 border-dashed border-foreground" aria-hidden="true" />
            <span className="text-foreground">Traza de falla (clic para nombre)</span>
          </li>
        </LegendSection>
      )}
    </div>
  )
}

function FocosLegend() {
  return (
    <LegendSection title="Focos activos (confianza)">
      {(["high", "nominal", "low", "unknown"] as const).map((key) => (
        <LegendRow key={key} round color={CONFIDENCE_STYLES[key].color} label={CONFIDENCE_STYLES[key].label} />
      ))}
    </LegendSection>
  )
}

function ClimaMarkersLegend() {
  return (
    <LegendSection title="Marcadores">
      <li className="text-xs leading-snug text-muted-foreground">
        Icono = condición actual; número = temperatura. Al acercar el zoom aparecen más veredas.
      </li>
    </LegendSection>
  )
}
