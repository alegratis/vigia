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
import {
  PRECIPITATION_LEVELS,
  PRECIPITATION_LEVEL_STYLES,
  type PrecipitationLevel,
} from "@/lib/precipitacion/levels"
import { TEMP_LEVELS, tempLevelColorToken, type TempLevel } from "@/lib/clima/api-types"
import {
  INDICATOR_LEVELS,
  INDICATOR_LEVEL_TOKENS,
  normalize,
  indicatorLevel,
  type IndicatorLevel,
} from "@/lib/demografia/indicator-levels"
import type { VeredaFeature, VeredaProperties, VeredasFeatureCollection } from "@/lib/veredas/api-types"

export const LAYER_KEYS = [
  "deslizamientos",
  "inundaciones",
  "incendios",
  "riesgo-compuesto",
  "precipitacion",
  "clima",
  "demografia",
  "sismologia",
  "hidrantes",
] as const
export type LayerKey = (typeof LAYER_KEYS)[number]

/** "fill" layers shade the shared vereda polygons; "points" layers render their own point source instead. */
export type LayerRenderMode = "fill" | "points"

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
  precipitacionLevel?: PrecipitationLevel | null
  precipitacionScore?: number | null
  climaLevel?: TempLevel | null
  climaScore?: number | null
  demografiaLevel?: IndicatorLevel | null
  demografiaScore?: number | null
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
  renderMode: LayerRenderMode
  /** The LabVereda field holding this layer's level for a vereda. "fill" layers only. */
  levelProperty?: keyof LabVereda
  /** The LabVereda field holding this layer's 0-1 composite score, for the compound summary. "fill" layers only. */
  scoreProperty?: keyof LabVereda
  levels?: readonly string[]
  levelStyles?: Record<string, LayerLevelStyle>
  /** Static GeoJSON asset or API route this "points" layer fetches on its own, independent of the shared vereda collection. */
  pointsUrl?: string
  /**
   * Clima, demografía, and hidrantes each read as their own single-purpose
   * map (a temperature snapshot, a population snapshot, a point inventory)
   * rather than a hazard fill meant to be read "through" another layer, so
   * stacking them with anything else just muddies the canvas without adding
   * insight. An exclusive layer always occupies the canvas alone: turning
   * one on clears every other active layer, and turning any other layer on
   * clears whichever exclusive layer was active.
   */
  exclusive?: boolean
  /**
   * Caps how many points render at once so the layer fits the viewport
   * without a separate scroll/pan affordance — the rest stay reachable
   * through the "ver todas" modal instead of being silently dropped.
   */
  maxVisiblePoints?: number
}

export const LAYER_DEFINITIONS: Record<LayerKey, LayerDefinition> = {
  deslizamientos: {
    key: "deslizamientos",
    label: "Deslizamientos",
    shortLabel: "Deslizamientos",
    image: "/images/deslizamientos-map.png",
    imageAlt: "Mapa de susceptibilidad a deslizamientos",
    renderMode: "fill",
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
    renderMode: "fill",
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
    renderMode: "fill",
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
    renderMode: "fill",
    levelProperty: "compoundLevel",
    scoreProperty: "compoundScore",
    levels: COMPOUND_LEVELS,
    levelStyles: COMPOUND_LEVEL_STYLES,
  },
  precipitacion: {
    key: "precipitacion",
    label: "Precipitación",
    shortLabel: "Precipitación",
    image: "/images/precipitacion-map.png",
    imageAlt: "Mapa de precipitación acumulada",
    renderMode: "fill",
    levelProperty: "precipitacionLevel",
    scoreProperty: "precipitacionScore",
    levels: PRECIPITATION_LEVELS,
    levelStyles: PRECIPITATION_LEVEL_STYLES,
  },
  clima: {
    key: "clima",
    label: "Clima",
    shortLabel: "Clima",
    image: "/images/clima-map.png",
    imageAlt: "Mapa de temperatura actual",
    renderMode: "fill",
    levelProperty: "climaLevel",
    scoreProperty: "climaScore",
    levels: TEMP_LEVELS,
    levelStyles: Object.fromEntries(
      TEMP_LEVELS.map((level) => [level, { label: level, colorToken: tempLevelColorToken(level) }]),
    ),
    exclusive: true,
  },
  demografia: {
    key: "demografia",
    label: "Demografía",
    shortLabel: "Demografía",
    image: "/images/demografia-map.png",
    imageAlt: "Mapa de indicadores demográficos",
    renderMode: "fill",
    levelProperty: "demografiaLevel",
    scoreProperty: "demografiaScore",
    levels: INDICATOR_LEVELS,
    levelStyles: Object.fromEntries(
      INDICATOR_LEVELS.map((level) => [level, { label: level, colorToken: INDICATOR_LEVEL_TOKENS[level] }]),
    ),
    exclusive: true,
  },
  sismologia: {
    key: "sismologia",
    label: "Sismología",
    shortLabel: "Sismología",
    image: "/images/sismologia-map.png",
    imageAlt: "Mapa de actividad sísmica reciente",
    renderMode: "points",
    pointsUrl: "/api/sismologia/eventos",
  },
  hidrantes: {
    key: "hidrantes",
    label: "Fuentes hídricas",
    shortLabel: "Hidrantes",
    image: "/images/hidrantes-map.png",
    imageAlt: "Mapa de hidrantes",
    renderMode: "points",
    pointsUrl: "/data/hidrantes/hidrantes-sevilla.geojson",
    maxVisiblePoints: 60,
    exclusive: true,
  },
}

export const LAYER_ORDER: LayerKey[] = [
  "deslizamientos",
  "inundaciones",
  "incendios",
  "riesgo-compuesto",
  "precipitacion",
  "clima",
  "demografia",
  "sismologia",
  "hidrantes",
]

/** Maximum simultaneously active layers — kept at 3 so the shared canvas stays legible even with 9 layers available in the rail. */
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

export function isExclusiveLayer(layer: LayerKey): boolean {
  return Boolean(LAYER_DEFINITIONS[layer].exclusive)
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

/**
 * Merges `nivel`/`acumuladoMm` from `/api/precipitacion/amenaza` (by
 * `codigoVereda`) onto the shared vereda collection — same pattern as
 * `mergeCompoundIntoVeredas`. The 0–1 score feeding the compound summary
 * is the accumulation scaled against the "Muy alto" base threshold (150mm
 * over 7 days, see `lib/precipitacion/levels.ts`), clamped to 1, so it's
 * directly comparable to the other layers' 0–1 scores without inventing a
 * second rainfall model.
 */
export function mergePrecipitacionIntoVeredas(
  veredas: VeredasFeatureCollection | LabVeredasFeatureCollection | null,
  precipitacion: { properties: { codigoVereda: string; nivel: string | null; acumuladoMm: number | null } }[] | null,
): LabVeredasFeatureCollection | null {
  if (!veredas) return null
  if (!precipitacion) return veredas as LabVeredasFeatureCollection
  const byCodigo = new Map(precipitacion.map((f) => [f.properties.codigoVereda, f.properties]))
  return {
    ...veredas,
    features: veredas.features.map((feature) => {
      const match = byCodigo.get(feature.properties.codigoVereda)
      const acumuladoMm = match?.acumuladoMm ?? null
      return {
        ...feature,
        properties: {
          ...feature.properties,
          precipitacionLevel: (match?.nivel as PrecipitationLevel | null) ?? null,
          precipitacionScore: acumuladoMm != null ? Math.min(1, acumuladoMm / 150) : null,
        },
      }
    }),
  }
}

/**
 * Merges `nivelTemp`/`tempActual` from `/api/clima/forecast` (by
 * `codigoVereda`) onto the shared vereda collection — same pattern as
 * `mergePrecipitacionIntoVeredas`. The 0–1 score normalizes the current
 * temperature against a fixed 10–32°C range, matching this study area's
 * observed highland-to-valley spread (see `lib/clima/api-types.ts`'s
 * `classifyTemp` bands) rather than the per-collection min/max used for
 * demografía, since temperature has a known, stable physical range.
 */
export function mergeClimaIntoVeredas(
  veredas: VeredasFeatureCollection | LabVeredasFeatureCollection | null,
  clima: { properties: { codigoVereda: string; nivelTemp: string | null; tempActual: number | null } }[] | null,
): LabVeredasFeatureCollection | null {
  if (!veredas) return null
  if (!clima) return veredas as LabVeredasFeatureCollection
  const byCodigo = new Map(clima.map((f) => [f.properties.codigoVereda, f.properties]))
  return {
    ...veredas,
    features: veredas.features.map((feature) => {
      const match = byCodigo.get(feature.properties.codigoVereda)
      const tempActual = match?.tempActual ?? null
      return {
        ...feature,
        properties: {
          ...feature.properties,
          climaLevel: (match?.nivelTemp as TempLevel | null) ?? null,
          climaScore: tempActual != null ? normalize(tempActual, 10, 32) : null,
        },
      }
    }),
  }
}

/**
 * Derives `demografiaLevel`/`demografiaScore` directly from each vereda's
 * own `poblacion` field — already present on the shared `/api/veredas`
 * collection, so unlike the other three "fill" layers this needs no
 * second fetch or merge-by-key, just a min-max normalization pass (see
 * `lib/demografia/indicator-levels.ts`) across whichever veredas are
 * currently loaded.
 */
export function deriveDemografiaLevels(
  veredas: VeredasFeatureCollection | LabVeredasFeatureCollection | null,
): LabVeredasFeatureCollection | null {
  if (!veredas) return null
  const poblaciones = veredas.features
    .map((feature) => feature.properties.poblacion)
    .filter((value): value is number => typeof value === "number")
  const min = poblaciones.length > 0 ? Math.min(...poblaciones) : 0
  const max = poblaciones.length > 0 ? Math.max(...poblaciones) : 0
  return {
    ...veredas,
    features: veredas.features.map((feature) => {
      const poblacion = feature.properties.poblacion
      if (typeof poblacion !== "number") {
        return { ...feature, properties: { ...feature.properties, demografiaLevel: null, demografiaScore: null } }
      }
      const score = normalize(poblacion, min, max)
      return {
        ...feature,
        properties: { ...feature.properties, demografiaLevel: indicatorLevel(score), demografiaScore: score },
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
  if (!levels) return -1
  const index = levels.indexOf(level)
  return index === -1 ? -1 : index / (levels.length - 1)
}

export type { SusceptibilityLevel, FloodSusceptibilityLevel, FireThreatLevel }
