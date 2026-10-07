"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Link2 } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
import { useVeredas } from "@/lib/veredas/use-veredas"
import { useCompoundVeredas } from "@/lib/riesgo-compuesto/use-compound-veredas"
import { useHidrantesExperience } from "@/lib/laboratorio/use-hidrantes-experience"
import { useDemografiaExperience } from "@/lib/laboratorio/use-demografia-experience"
import { MUNICIPIOS } from "@/lib/veredas/municipio-toggles"
import { AlejandroPinoLogo } from "@/components/brand/alejandro-pino-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import type { PrecipitacionAmenazaResponse } from "@/lib/precipitacion/api-types"
import type { ClimaForecastResponse } from "@/lib/clima/api-types"
import {
  DEFAULT_LAB_STATE,
  MAX_ACTIVE_LAYERS,
  LAYER_DEFINITIONS,
  findConflicts,
  isExclusiveLayer,
  mergeCompoundIntoVeredas,
  mergePrecipitacionIntoVeredas,
  mergeClimaIntoVeredas,
  deriveDemografiaLevels,
  resolveSubLayerOn,
  parseLabState,
  readLabStateFromStorage,
  serializeLabState,
  writeLabStateToStorage,
  type LabState,
  type LabVeredasFeatureCollection,
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

const jsonFetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar ${url}`)
  return res.json()
}

/**
 * Central client state for `/laboratorio`: active layers, selected
 * municipio, 2D/3D mode, URL + localStorage sync, the 3-layer limit, and
 * conflict-popover bookkeeping. Delegates all rendering to its children —
 * this component only owns state and the handlers that mutate it.
 */
export function LabWorkspace() {
  const { veredas } = useVeredas(true)

  const [state, setState] = useState<LabState>(DEFAULT_LAB_STATE)
  const [previewLayer, setPreviewLayer] = useState<LayerKey | null>(null)

  // Each of these four "fill" layers beyond the original three fetches (or derives) its own
  // data lazily — only once it's actually active or rail-previewed — then gets merged onto the
  // shared vereda collection by the matching lib/laboratorio/layers.ts helper, same pattern as
  // the original mergeCompoundIntoVeredas.
  const needsCompound = state.layers.includes("riesgo-compuesto") || previewLayer === "riesgo-compuesto"
  const needsPrecipitacion = state.layers.includes("precipitacion") || previewLayer === "precipitacion"
  const needsClima = state.layers.includes("clima") || previewLayer === "clima"
  const { veredas: compound } = useCompoundVeredas(needsCompound)
  const { data: precipitacionData } = useSWR<PrecipitacionAmenazaResponse>(
    needsPrecipitacion ? "/api/precipitacion/amenaza?mode=historico&window=7&fuente=power" : null,
    jsonFetcher,
    { revalidateOnFocus: false },
  )
  const { data: climaData } = useSWR<ClimaForecastResponse>(
    needsClima ? "/api/clima/forecast" : null,
    jsonFetcher,
    { revalidateOnFocus: false },
  )
  const labVeredas = useMemo(() => {
    let next: LabVeredasFeatureCollection | null = mergeCompoundIntoVeredas(veredas, compound?.features ?? null)
    next = mergePrecipitacionIntoVeredas(next, precipitacionData?.veredas.features ?? null)
    next = mergeClimaIntoVeredas(next, climaData?.veredas.features ?? null)
    next = deriveDemografiaLevels(next)
    return next
  }, [veredas, compound, precipitacionData, climaData])

  const [hydrated, setHydrated] = useState(false)
  const [lastActivatedLayer, setLastActivatedLayer] = useState<LayerKey | null>(null)
  const [limitDialogOpen, setLimitDialogOpen] = useState(false)
  const [conflict, setConflict] = useState<{ a: LayerKey; b: LayerKey; severity: "alto" | "medio" } | null>(null)
  const [layerOpacity, setLayerOpacity] = useState<Record<LayerKey, number>>({
    deslizamientos: DEFAULT_LAYER_OPACITY,
    inundaciones: DEFAULT_LAYER_OPACITY,
    incendios: DEFAULT_LAYER_OPACITY,
    "riesgo-compuesto": DEFAULT_LAYER_OPACITY,
    precipitacion: DEFAULT_LAYER_OPACITY,
    clima: DEFAULT_LAYER_OPACITY,
    demografia: DEFAULT_LAYER_OPACITY,
    sismologia: DEFAULT_LAYER_OPACITY,
    hidrantes: DEFAULT_LAYER_OPACITY,
  })
  const [selectedVereda, setSelectedVereda] = useState<VeredaFeature | null>(null)

  // Weather report shown in the bottom panel: the clicked vereda when there is one, otherwise the casco
  // urbano of the selected municipio (Sevilla by default) so the card is never empty.
  const climaVereda = useMemo(() => {
    const features = climaData?.veredas.features ?? []
    if (selectedVereda) {
      const match = features.find((f) => f.properties.codigoVereda === selectedVereda.properties.codigoVereda)
      if (match) return match.properties
    }
    const target = state.municipio ?? "Sevilla"
    return (
      features.find((f) => f.properties.esCascoUrbano && f.properties.municipio === target)?.properties ??
      features.find((f) => f.properties.esCascoUrbano)?.properties ??
      null
    )
  }, [climaData, selectedVereda, state.municipio])
  // Lifted here (rather than owned inside BottomTabs) so the right-side ContextPanel can shrink
  // its own height to match — otherwise an expanded bottom panel and a full-height right panel
  // would overlap in the bottom-right corner.
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(true)
  // Right panel: open by default on desktop, collapsed on mobile (resolved after mount so SSR markup stays stable).
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true)
  useEffect(() => {
    setRightPanelCollapsed(!window.matchMedia("(min-width: 640px)").matches)
  }, [])
  // Keyed by bare sub-layer id (see `resolveSubLayerOn`) rather than per-hazard-layer, since ids
  // are already unique across every hazard that offers one.
  const [subLayerToggles, setSubLayerToggles] = useState<Record<string, boolean>>({})

  // Same "last activated, else last in the active list" convention the context panel and bottom
  // panel both already used inline — hoisted here once `LabMap` also needs to know which single
  // layer's sub-layers are in play.
  const focusLayer = useMemo(
    () =>
      (lastActivatedLayer && state.layers.includes(lastActivatedLayer)
        ? lastActivatedLayer
        : state.layers[state.layers.length - 1]) ?? null,
    [lastActivatedLayer, state.layers],
  )

  const hidrantesExperience = useHidrantesExperience(focusLayer === "hidrantes")
  const demografiaExperience = useDemografiaExperience(focusLayer === "demografia")

  const [optionValues, setOptionValues] = useState<Record<string, string>>({})
  const handleOptionChange = useCallback((id: string, value: string) => {
    setOptionValues((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleToggleSubLayer = useCallback(
    (id: string) => {
      if (!focusLayer) return
      setSubLayerToggles((prev) => ({ ...prev, [id]: !resolveSubLayerOn(focusLayer, id, prev) }))
    },
    [focusLayer],
  )

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

        // Clima, demografía, and hidrantes never share the canvas with
        // another layer — activating one replaces whatever is active,
        // and activating anything else drops one of these if it's active.
        if (isExclusiveLayer(layer)) {
          if (prev.layers.length > 0) {
            toast(`${LAYER_DEFINITIONS[layer].label} no se combina con otras capas`)
          }
          setLastActivatedLayer(layer)
          setConflict(null)
          return { ...prev, layers: [layer] }
        }
        const previousExclusive = prev.layers.find((l) => isExclusiveLayer(l))
        const baseLayers = previousExclusive ? prev.layers.filter((l) => l !== previousExclusive) : prev.layers
        if (previousExclusive) {
          toast(`${LAYER_DEFINITIONS[previousExclusive].label} no se combina con otras capas`)
        }

        if (baseLayers.length >= MAX_ACTIVE_LAYERS) {
          setLimitDialogOpen(true)
          return prev
        }
        const nextLayers = [...baseLayers, layer]
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
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/" aria-label="RED LabOT — volver al inicio" className="relative hidden h-6 items-center justify-center sm:flex">
            <Image
              src="/images/redlabot-mark-light.png"
              alt="RED LabOT"
              width={100}
              height={45}
              className="block h-5 w-auto dark:hidden"
              priority
            />
            <Image
              src="/images/redlabot-mark-dark.png"
              alt="RED LabOT"
              width={100}
              height={45}
              className="hidden h-5 w-auto dark:block"
              priority
            />
          </Link>
          <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
          <Link href="/" aria-label="Vigía — volver al inicio" className="relative flex size-6 shrink-0 items-center justify-center sm:size-7">
            <Image
              src="/images/vigia-mark-light.png"
              alt="Vigía"
              width={84}
              height={65}
              className="block dark:hidden"
              priority
            />
            <Image
              src="/images/vigia-mark-dark.png"
              alt="Vigía"
              width={84}
              height={65}
              className="hidden dark:block"
              priority
            />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground sm:text-base">Laboratorio</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{headerSubtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="https://nasalifelines.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Image
                src="/images/nasa-lifelines-wordmark-darkblue.png"
                alt="NASA Lifelines"
                width={5112}
                height={643}
                className="block h-5 w-auto dark:hidden"
              />
              <Image
                src="/images/nasa-lifelines-wordmark-white.png"
                alt="NASA Lifelines"
                width={5112}
                height={643}
                className="hidden h-5 w-auto dark:block"
              />
            </a>
            <AlejandroPinoLogo className="h-6" />
            <span aria-hidden="true" className="h-6 w-px bg-border" />
          </div>
          <Select value={activeMunicipioValue} onValueChange={handleMunicipioChange}>
            <SelectTrigger className="h-8 w-28 text-xs sm:w-40">
              <SelectValue placeholder="Municipio">
                {(value: string | null) => (!value || value === "__all__" ? "Todos los municipios" : value)}
              </SelectValue>
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
          <Button size="sm" variant="secondary" onClick={handleShare} className="hidden sm:inline-flex">
            <Link2 className="size-3.5" />
            Compartir vista
          </Button>
          <Button size="icon" variant="secondary" onClick={handleShare} className="sm:hidden" aria-label="Compartir vista">
            <Link2 className="size-3.5" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Single relative canvas: the map fills it completely, every control floats on top as its
          own translucent, blurred card instead of a bordered side column — so the map stays the
          one continuous surface and nothing permanently eats into its width. */}
      <div className="relative min-h-0 flex-1">
        <LabMap
          veredas={labVeredas}
          activeLayers={state.layers}
          previewLayer={previewLayer}
          layerOpacity={layerOpacity}
          municipio={state.municipio}
          is3D={state.is3D}
          onToggle3D={handleToggle3D}
          onVeredaSelect={setSelectedVereda}
          focusLayer={focusLayer}
          subLayerToggles={subLayerToggles}
          optionValues={optionValues}
          hidrantesExperience={hidrantesExperience}
          demografiaExperience={demografiaExperience}
          climaData={climaData ?? null}
        />

        <LayerRail activeLayers={state.layers} onToggle={handleToggleLayer} onHoverLayer={setPreviewLayer} />

        <ContextPanel
          veredas={labVeredas}
          activeLayers={state.layers}
          lastActivatedLayer={lastActivatedLayer}
          previewLayer={previewLayer}
          subLayerToggles={subLayerToggles}
          onToggleSubLayer={handleToggleSubLayer}
          bottomPanelCollapsed={bottomPanelCollapsed}
          collapsed={rightPanelCollapsed}
          onCollapsedChange={setRightPanelCollapsed}
          hidrantesExperience={hidrantesExperience}
          demografiaExperience={demografiaExperience}
          optionValues={optionValues}
          onOptionChange={handleOptionChange}
        />

        <LayerConflictPopover
          conflict={conflict}
          newLayer={conflict ? lastActivatedLayer : null}
          opacity={lastActivatedLayer ? layerOpacity[lastActivatedLayer] : DEFAULT_LAYER_OPACITY}
          onChangeOpacity={(value) => lastActivatedLayer && handleOpacityChange(lastActivatedLayer, value)}
          onDismiss={() => setConflict(null)}
        />

        <BottomTabs
          veredas={labVeredas}
          activeLayers={state.layers}
          lastActivatedLayer={lastActivatedLayer}
          selectedVereda={selectedVereda}
          climaVereda={climaVereda}
          onClearSelection={() => setSelectedVereda(null)}
          collapsed={bottomPanelCollapsed}
          onCollapsedChange={setBottomPanelCollapsed}
        />
      </div>

      <LayerLimitDialog
        open={limitDialogOpen}
        activeCount={state.layers.length}
        onDismiss={() => setLimitDialogOpen(false)}
      />

      {selectedVereda && null /* selection currently only drives the map popup; reserved for future cross-linking to the bottom panel */}
    </div>
  )
}
