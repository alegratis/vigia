"use client"

import Image from "next/image"
import { Layers } from "lucide-react"
import {
  LAYER_DEFINITIONS,
  levelSeverity,
  resolveSubLayerOn,
  type LabVeredasFeatureCollection,
  type LayerKey,
} from "@/lib/laboratorio/layers"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

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
}: ContextPanelProps) {
  const focusLayer =
    lastActivatedLayer && activeLayers.includes(lastActivatedLayer)
      ? lastActivatedLayer
      : activeLayers[activeLayers.length - 1] ?? null

  const content = previewLayer ? (
    <PreviewSummary veredas={veredas} layer={previewLayer} />
  ) : activeLayers.length === 0 ? (
    <CompoundSummary veredas={veredas} />
  ) : (
    <LayerLegend veredas={veredas} layer={focusLayer!} activeLayers={activeLayers} />
  )

  const subLayers = !previewLayer && focusLayer ? LAYER_DEFINITIONS[focusLayer].subLayers : undefined

  return (
    <div
      className={`absolute right-3 top-3 z-10 hidden w-72 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-md transition-[bottom] sm:flex ${
        bottomPanelCollapsed ? "bottom-[4.25rem]" : "bottom-3 sm:bottom-[calc(42%+1.5rem)]"
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
      {subLayers && subLayers.length > 0 && (
        <div className="shrink-0 border-t border-border/70 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Layers className="size-3.5" aria-hidden="true" />
            Capas
          </p>
          <ul className="flex flex-col gap-2">
            {subLayers.map((sub) => {
              const checked = resolveSubLayerOn(focusLayer!, sub.id, subLayerToggles)
              return (
                <li key={sub.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`sublayer-${sub.id}`}
                    checked={checked}
                    onCheckedChange={() => onToggleSubLayer(sub.id)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`sublayer-${sub.id}`} className="text-xs font-normal leading-snug text-foreground">
                    {sub.label}
                  </Label>
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
