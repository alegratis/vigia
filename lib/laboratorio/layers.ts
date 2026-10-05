/**
 * Declarative definition of the 3 hazard layers combined on the
 * `/laboratorio` single-canvas prototype (see v0_plans/grand-method.md).
 * Each layer reuses an existing per-vereda hazard level/color scheme
 * verbatim from its production `lib/<hazard>/levels.ts` — no new levels,
 * thresholds, or colors are introduced here, and no hazard model/API is
 * touched. No server imports.
 */

import {
  SUSCEPTIBILITY_LEVELS,
  SUSCEPTIBILITY_LEVEL_STYLES,
  type SusceptibilityLevel,
} from "@/lib/deslizamientos/levels"
import {
  FLOOD_SUSCEPTIBILITY_LEVELS,
  FLOOD_SUSCEPTIBILITY_LEVEL_STYLES,
  type FloodSusceptibilityLevel,
} from "@/lib/inundaciones/levels"
import { FIRE_THREAT_LEVELS, FIRE_THREAT_LEVEL_STYLES, type FireThreatLevel } from "@/lib/incendios/levels"
import { COMPOUND_LEVELS, COMPOUND_LEVEL_STYLES, type CompoundLevel } from "@/lib/riesgo-compuesto/levels"
import type { VeredaFeature, VeredaProperties, VeredasFeatureCollection } from "@/lib/veredas/api-types"

export const LAYER_KEYS = ["deslizamientos", "inundaciones", "incendios", "riesgo-compuesto"] as const
export type LayerKey = (typeof LAYER_KEYS)[number]

/**
 * `VeredaProperties` plus the compound-risk fields, merged in client-side
 * (by `codigoVereda`) from the separate `/api/riesgo-compuesto/veredas`
 * response before reaching any laboratorio component — see
 * `lab-workspace.tsx`'s `mergeCompoundIntoVeredas`. Keeping this as a
 * laboratorio-only extension (rather than adding these fields to the real
 * `VeredaProperties` in `lib/veredas/api-types.ts`) avoids touching the
 * production API type for a prototype-only field.
 */
export interface LabVereda extends VeredaProperties {
  compoundLevel?: CompoundLevel | null
  compoundScore?: number | null
}
export interface LabVeredaFeature extends Omit<VeredaFeature, "properties"> {
  properties: LabVereda
}
export interface LabVeredasFeatureCollection extends Omit<VeredasFeatureCollection, "features"> {
  features: LabVeredaFeature[]
}

/** Every layer resolves to the same `{ level, score }` shape per vereda, whatever its source property names. */
interface LayerLevelStyle {
  label: string
  colorToken: string
}

export interface LayerDefinition {
  key: LayerKey
  label: string
  /** Short noun phrase used in rail tooltips and the conflict popover. */
  shortLabel: string
  image: string
  imageAlt: string
  /** The LabVereda field holding this layer's level for a vereda. */
  levelProperty: keyof LabVereda
  /** The LabVereda field holding this layer's 0-1 composite score, for the compound summary. */
  scoreProperty: keyof LabVereda
  levels: readonly string[]
  levelStyles: Record<string, LayerLevelStyle>
}

export const LAYER_DEFINITIONS: Record<LayerKey, LayerDefinition> = {
  deslizamientos: {
    key: "deslizamientos",
    label: "Deslizamientos",
    shortLabel: "Deslizamientos",
    image: "/images/deslizamientos-map.png",
    imageAlt: "Mapa de susceptibilidad a deslizamientos",
    levelProperty: "dominantLevel",
    scoreProperty: "isScoreAvg",
    levels: SUSCEPTIBILITY_LEVELS,
    levelStyles: SUSCEPTIBILITY_LEVEL_STYLES,
  },
  inundaciones: {
    key: "inundaciones",
    label: "Inundaciones",
    shortLabel: "Inundaciones",
    image: "/images/inundaciones-map.png",
    imageAlt: "Mapa de susceptibilidad a inundaciones",
    levelProperty: "floodLevel",
    scoreProperty: "floodScoreAvg",
    levels: FLOOD_SUSCEPTIBILITY_LEVELS,
    levelStyles: FLOOD_SUSCEPTIBILITY_LEVEL_STYLES,
  },
  incendios: {
    key: "incendios",
    label: "Incendios forestales",
    shortLabel: "Incendios",
    image: "/images/incendios-map.png",
    imageAlt: "Mapa de amenaza de incendios forestales",
    levelProperty: "fireLevel",
    scoreProperty: "fireScoreAvg",
    levels: FIRE_THREAT_LEVELS,
    levelStyles: FIRE_THREAT_LEVEL_STYLES,
  },
  "riesgo-compuesto": {
    key: "riesgo-compuesto",
    label: "Riesgo compuesto",
    shortLabel: "Riesgo compuesto",
    image: "/images/riesgo-compuesto-map.png",
    imageAlt: "Mapa de riesgo compuesto multiamenaza",
    levelProperty: "compoundLevel",
    scoreProperty: "compoundScore",
    levels: COMPOUND_LEVELS,
    levelStyles: COMPOUND_LEVEL_STYLES,
  },
}

export const LAYER_ORDER: LayerKey[] = ["deslizamientos", "inundaciones", "incendios", "riesgo-compuesto"]

/** Maximum simultaneously active layers. Currently equals the total layer count, written generically so a future 4th layer makes this limit meaningful without touching the check itself. */
export const MAX_ACTIVE_LAYERS = 3

/**
 * Pairs whose fills visually interfere badly enough to warn about (declared
 * ahead of the hazards that implement them — "precipitacion" has no layer
 * yet, so that pair can never actually trigger today, but the table doesn't
 * need to change when it's added later).
 */
const CONFLICT_PAIRS: Array<[string, string, "alto" | "medio"]> = [
  ["deslizamientos", "incendios", "alto"],
  ["inundaciones", "precipitacion", "medio"],
]

export function conflictSeverity(a: LayerKey, b: LayerKey): "alto" | "medio" | null {
  const match = CONFLICT_PAIRS.find(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  )
  return match?.[2] ?? null
}

/** Every pairing among the given active layers that's flagged as conflicting, most severe first. */
export function findConflicts(active: LayerKey[]): Array<{ a: LayerKey; b: LayerKey; severity: "alto" | "medio" }> {
  const found: Array<{ a: LayerKey; b: LayerKey; severity: "alto" | "medio" }> = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const severity = conflictSeverity(active[i], active[j])
      if (severity) found.push({ a: active[i], b: active[j], severity })
    }
  }
  return found.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === "alto" ? -1 : 1))
}

export function isLayerKey(value: string): value is LayerKey {
  return (LAYER_KEYS as readonly string[]).includes(value)
}

/**
 * Merges `compoundLevel`/`compoundScore` from `/api/riesgo-compuesto/veredas`
 * (by `codigoVereda`) onto the shared `/api/veredas` collection, so the
 * "riesgo-compuesto" layer can reuse the exact same generic fill/legend/chart
 * code path as the other three layers instead of a special-cased data
 * source. Returns `veredas` unchanged (not merged) while the compound fetch
 * is still loading or disabled — the layer then simply has no data yet.
 */
export function mergeCompoundIntoVeredas(
  veredas: VeredasFeatureCollection | null,
  compound: { properties: { codigoVereda: string; compoundLevel: CompoundLevel | null; compoundScore: number | null } }[] | null,
): LabVeredasFeatureCollection | null {
  if (!veredas) return null
  if (!compound) return veredas as LabVeredasFeatureCollection
  const byCodigo = new Map(compound.map((f) => [f.properties.codigoVereda, f.properties]))
  return {
    ...veredas,
    features: veredas.features.map((feature) => {
      const match = byCodigo.get(feature.properties.codigoVereda)
      return {
        ...feature,
        properties: {
          ...feature.properties,
          compoundLevel: match?.compoundLevel ?? null,
          compoundScore: match?.compoundScore ?? null,
        },
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// URL + localStorage state
// ---------------------------------------------------------------------------

export interface LabState {
  layers: LayerKey[]
  municipio: string | null
  is3D: boolean
  zoom: number | null
  center: [number, number] | null
}

export const DEFAULT_LAB_STATE: LabState = {
  layers: [],
  municipio: null,
  is3D: false,
  zoom: null,
  center: null,
}

export const LAB_STORAGE_KEY = "laboratorio:state"

/** Parses `?mode=analitico&layers=a,b&zoom=12&center=lon,lat&municipio=x` — invalid/missing values fall back to defaults field-by-field. */
export function parseLabState(params: URLSearchParams): LabState {
  const layersParam = params.get("layers")
  const layers = layersParam
    ? (layersParam.split(",").filter(isLayerKey) as LayerKey[]).slice(0, MAX_ACTIVE_LAYERS)
    : []

  const municipio = params.get("municipio")

  const zoomRaw = params.get("zoom")
  const zoom = zoomRaw && !Number.isNaN(Number(zoomRaw)) ? Number(zoomRaw) : null

  const centerRaw = params.get("center")
  let center: [number, number] | null = null
  if (centerRaw) {
    const [lon, lat] = centerRaw.split(",").map(Number)
    if (Number.isFinite(lon) && Number.isFinite(lat)) center = [lon, lat]
  }

  return {
    layers,
    municipio: municipio && municipio.length > 0 ? municipio : null,
    is3D: params.get("is3D") === "1",
    zoom,
    center,
  }
}

/** Inverse of `parseLabState`, for `history.replaceState` + the "share view" link. `mode=analitico` is always written even though it's the only mode today, so the URL shape doesn't need to change when a second mode is added. */
export function serializeLabState(state: LabState): URLSearchParams {
  const params = new URLSearchParams()
  params.set("mode", "analitico")
  if (state.layers.length > 0) params.set("layers", state.layers.join(","))
  if (state.municipio) params.set("municipio", state.municipio)
  if (state.is3D) params.set("is3D", "1")
  if (state.zoom != null) params.set("zoom", state.zoom.toFixed(2))
  if (state.center) params.set("center", `${state.center[0].toFixed(5)},${state.center[1].toFixed(5)}`)
  return params
}

export function readLabStateFromStorage(): LabState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LAB_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LabState>
    return {
      layers: Array.isArray(parsed.layers) ? (parsed.layers.filter(isLayerKey) as LayerKey[]) : [],
      municipio: typeof parsed.municipio === "string" ? parsed.municipio : null,
      is3D: Boolean(parsed.is3D),
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : null,
      center: Array.isArray(parsed.center) && parsed.center.length === 2 ? (parsed.center as [number, number]) : null,
    }
  } catch {
    return null
  }
}

export function writeLabStateToStorage(state: LabState): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can fail (quota, private browsing) — losing persistence silently is fine here.
  }
}

/** A level string's position within its own layer's scale, 0 (lowest) to 1 (highest) — used for the compound "most severe wins" summary. */
export function levelSeverity(layer: LayerKey, level: string | null): number {
  if (!level) return -1
  const levels = LAYER_DEFINITIONS[layer].levels
  const index = levels.indexOf(level)
  return index === -1 ? -1 : index / (levels.length - 1)
}

export type { SusceptibilityLevel, FloodSusceptibilityLevel, FireThreatLevel }
