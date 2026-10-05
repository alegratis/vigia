"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link2 } from "lucide-react"
import { toast } from "sonner"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { MUNICIPIOS } from "@/lib/veredas/municipio-toggles"
import {
  DEFAULT_LAB_STATE,
  MAX_ACTIVE_LAYERS,
  findConflicts,
  parseLabState,
  readLabStateFromStorage,
  serializeLabState,
  writeLabStateToStorage,
  type LabState,
  type LayerKey,
} from "@/lib/laboratorio/layers"
import { LabMap } from "@/components/laboratorio/lab-map"
import { LayerRail } from "@/components/laboratorio/layer-rail"
import { ContextPanel } from "@/components/laboratorio/context-panel"
import { BottomTabs } from "@/components/laboratorio/bottom-tabs"
import { LayerLimitDialog } from "@/components/laboratorio/layer-limit-dialog"
import { LayerConflictPopover } from "@/components/laboratorio/layer-conflict-popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { VeredaFeature } from "@/lib/veredas/api-types"

const DEFAULT_LAYER_OPACITY = 0.55

/**
 * Central client state for `/laboratorio`: active layers, selected
 * municipio, 2D/3D mode, URL + localStorage sync, the 3-layer limit, and
 * conflict-popover bookkeeping. Delegates all rendering to its children —
 * this component only owns state and the handlers that mutate it.
 */
export function LabWorkspace() {
  const { veredas } = useVeredas(true)

  const [state, setState] = useState<LabState>(DEFAULT_LAB_STATE)
  const [hydrated, setHydrated] = useState(false)
  const [previewLayer, setPreviewLayer] = useState<LayerKey | null>(null)
  const [lastActivatedLayer, setLastActivatedLayer] = useState<LayerKey | null>(null)
  const [limitDialogOpen, setLimitDialogOpen] = useState(false)
  const [conflict, setConflict] = useState<{ a: LayerKey; b: LayerKey; severity: "alto" | "medio" } | null>(null)
  const [layerOpacity, setLayerOpacity] = useState<Record<LayerKey, number>>({
    deslizamientos: DEFAULT_LAYER_OPACITY,
    inundaciones: DEFAULT_LAYER_OPACITY,
    incendios: DEFAULT_LAYER_OPACITY,
  })
  const [selectedVereda, setSelectedVereda] = useState<VeredaFeature | null>(null)

  // Reads `?layers=...` first, falling back to localStorage, on mount only — the URL is the
  // source of truth for a shared link, localStorage is just a same-device convenience fallback.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.size > 0 ? parseLabState(params) : null
    const initial = fromUrl ?? readLabStateFromStorage() ?? DEFAULT_LAB_STATE
    setState(initial)
    setHydrated(true)
  }, [])

  // Debounced URL + localStorage sync whenever state changes post-hydration.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hydrated) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = serializeLabState(state)
      window.history.replaceState(null, "", `?${params.toString()}`)
      writeLabStateToStorage(state)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [state, hydrated])

  const handleToggleLayer = useCallback(
    (layer: LayerKey) => {
      setState((prev) => {
        const isActive = prev.layers.includes(layer)
        if (isActive) {
          return { ...prev, layers: prev.layers.filter((l) => l !== layer) }
        }
        if (prev.layers.length >= MAX_ACTIVE_LAYERS) {
          setLimitDialogOpen(true)
          return prev
        }
        const nextLayers = [...prev.layers, layer]
        const conflicts = findConflicts(nextLayers)
        const newConflict = conflicts.find((c) => c.a === layer || c.b === layer)
        if (newConflict) setConflict(newConflict)
        setLastActivatedLayer(layer)
        return { ...prev, layers: nextLayers }
      })
    },
    [],
  )

  const handleMunicipioChange = useCallback((value: string | null) => {
    setState((prev) => ({ ...prev, municipio: !value || value === "__all__" ? null : value }))
  }, [])

  const handleToggle3D = useCallback(() => {
    setState((prev) => ({ ...prev, is3D: !prev.is3D }))
  }, [])

  const handleShare = useCallback(() => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast("Enlace copiado"))
      .catch(() => toast.error("No se pudo copiar el enlace"))
  }, [])

  const handleOpacityChange = useCallback((layer: LayerKey, value: number) => {
    setLayerOpacity((prev) => ({ ...prev, [layer]: value }))
  }, [])

  const activeMunicipioValue = state.municipio ?? "__all__"

  const headerSubtitle = useMemo(() => {
    if (state.layers.length === 0) return "Ninguna capa activa · riesgo compuesto"
    return `${state.layers.length} / ${MAX_ACTIVE_LAYERS} capas activas`
  }, [state.layers.length])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="font-medium text-foreground">Laboratorio · mapa único multicapa</p>
          <p className="text-xs text-muted-foreground">{headerSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeMunicipioValue} onValueChange={handleMunicipioChange}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Municipio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los municipios</SelectItem>
              {MUNICIPIOS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="secondary" onClick={handleShare}>
            <Link2 className="size-3.5" />
            Compartir vista
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <LayerRail activeLayers={state.layers} onToggle={handleToggleLayer} onHoverLayer={setPreviewLayer} />

        <div className="relative min-w-0 flex-1">
          <LabMap
            veredas={veredas}
            activeLayers={state.layers}
            previewLayer={previewLayer}
            layerOpacity={layerOpacity}
            municipio={state.municipio}
            is3D={state.is3D}
            onToggle3D={handleToggle3D}
            onVeredaSelect={setSelectedVereda}
          />

          <LayerConflictPopover
            conflict={conflict}
            newLayer={conflict ? lastActivatedLayer : null}
            opacity={lastActivatedLayer ? layerOpacity[lastActivatedLayer] : DEFAULT_LAYER_OPACITY}
            onChangeOpacity={(value) => lastActivatedLayer && handleOpacityChange(lastActivatedLayer, value)}
            onDismiss={() => setConflict(null)}
          />
        </div>

        <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-border bg-card/60 sm:block">
          <ContextPanel
            veredas={veredas}
            activeLayers={state.layers}
            lastActivatedLayer={lastActivatedLayer}
            previewLayer={previewLayer}
          />
        </div>
      </div>

      <BottomTabs veredas={veredas} activeLayers={state.layers} />

      <LayerLimitDialog
        open={limitDialogOpen}
        activeCount={state.layers.length}
        onDismiss={() => setLimitDialogOpen(false)}
      />

      {selectedVereda && null /* selection currently only drives the map popup; reserved for future cross-linking to the bottom panel */}
    </div>
  )
}
