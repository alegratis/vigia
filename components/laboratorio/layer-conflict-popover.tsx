"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LAYER_DEFINITIONS, type LayerKey } from "@/lib/laboratorio/layers"

interface LayerConflictPopoverProps {
  conflict: { a: LayerKey; b: LayerKey; severity: "alto" | "medio" } | null
  /** The layer that was just activated and triggered this conflict — its opacity is what the slider controls. */
  newLayer: LayerKey | null
  opacity: number
  onChangeOpacity: (value: number) => void
  onDismiss: () => void
}

/**
 * Non-blocking warning anchored to the layer rail when two simultaneously
 * active layers are known to visually interfere (see
 * `lib/laboratorio/layers.ts`'s `CONFLICT_PAIRS`). Offers an inline opacity
 * fix for the layer that just triggered it; "Cambiar patrón" is left as a
 * documented placeholder per the plan's explicit scope cut, and "Ignorar"
 * just closes it — the layers stay active either way.
 */
export function LayerConflictPopover({
  conflict,
  newLayer,
  opacity,
  onChangeOpacity,
  onDismiss,
}: LayerConflictPopoverProps) {
  const [adjusting, setAdjusting] = useState(false)

  if (!conflict || !newLayer) return null

  const other = conflict.a === newLayer ? conflict.b : conflict.a

  return (
    <Popover open onOpenChange={(next) => !next && onDismiss()}>
      <PopoverTrigger
        className="pointer-events-none absolute left-16 top-3 size-0 border-0 bg-transparent p-0"
        tabIndex={-1}
        aria-hidden="true"
      />
      <PopoverContent side="right" align="start" className="w-72 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground">Capas pueden solaparse visualmente</p>
            <p className="text-muted-foreground">
              {LAYER_DEFINITIONS[newLayer].shortLabel} y {LAYER_DEFINITIONS[other].shortLabel} comparten tonos
              similares sobre la misma geometría. Considera ajustar la transparencia.
            </p>
          </div>
        </div>

        {adjusting ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Opacidad de {LAYER_DEFINITIONS[newLayer].shortLabel}: {Math.round(opacity * 100)}%
            </p>
            <Slider
              value={[opacity * 100]}
              min={15}
              max={100}
              step={5}
              onValueChange={(next) => {
                const value = Array.isArray(next) ? next[0] : next
                onChangeOpacity(value / 100)
              }}
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAdjusting(true)}>
              Ajustar opacidad
            </Button>
            <Button size="sm" variant="secondary" disabled title="Próximamente">
              Cambiar patrón
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Ignorar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
