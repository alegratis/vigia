"use client"

/**
 * Full DANE demografía indicator experience (pobreza multidimensional,
 * viviendas/hogares/personas por manzana, índice de vulnerabilidad
 * compuesto) ported from `components/maps/demografia-live-map.tsx` so the
 * laboratorio's shared single map can offer the same indicator-switching
 * buttons and legends instead of the flat population-only choropleth the
 * "demografia" layer previously rendered — this is core, not optional, for
 * the "demografia" layer in the lab (see `use-hidrantes-experience.ts` for
 * the sibling "focused hazard gets its own rich experience" pattern).
 *
 * Deliberately map-ref-free, same contract as `useHidrantesExperience`:
 * every derived value here is pure data (GeoJSON FeatureCollections, legend
 * colors). `lab-map.tsx` owns the actual `<Map>` and turns these into a
 * `Source`/`Layer` + click popups; `context-panel.tsx` turns them into the
 * indicator-switch buttons and legend.
 */

import { useEffect, useMemo, useState } from "react"
import { useDemografiaGeoportal } from "@/lib/demografia/use-geoportal"
import { useVulnerabilidad } from "@/lib/vulnerabilidad/use-vulnerabilidad"
import { resolveCssColor } from "@/lib/resolve-css-color"
import {
  INDICATOR_LEVELS,
  INDICATOR_LEVEL_TOKENS,
  normalize,
  indicatorLevel,
  indicatorHeight,
} from "@/lib/demografia/indicator-levels"
import { VULNERABILITY_LEVELS, VULNERABILITY_LEVEL_STYLES } from "@/lib/vulnerabilidad/levels"

export type DemografiaIndicator = "vulnerabilidad" | "pobreza" | "manzanas"
export type ManzanaField = "viviendas" | "hogares" | "personas"

export const MANZANA_FIELD_LABEL: Record<ManzanaField, string> = {
  viviendas: "Viviendas",
  hogares: "Hogares",
  personas: "Personas",
}

/** Single stable id pair reused across every indicator — only one is ever rendered at once (demografía is exclusive), and keeping the id constant across indicator switches avoids react-map-gl reusing the same JSX-position `<Layer>` with a changed `id`, which trips MapLibre's own "id/type never change in place" assertion (see lab-map.tsx's preview-source fix for the same failure mode). */
export const DEMOGRAFIA_SOURCE_ID = "lab-demografia-source"
export const DEMOGRAFIA_LAYER_ID = "lab-demografia-columns"

/**
 * @param enabled Only fetches/computes while the demografía layer is
 * actually focused — same lazy-fetch convention as `useHidrantesExperience`.
 */
export function useDemografiaExperience(enabled: boolean) {
  const [indicator, setIndicator] = useState<DemografiaIndicator>("vulnerabilidad")
  const [manzanaField, setManzanaField] = useState<ManzanaField>("personas")

  const { data, error: geoportalError } = useDemografiaGeoportal(enabled && indicator !== "vulnerabilidad")
  const { data: vulnerabilidadData, error: vulnerabilidadError } = useVulnerabilidad(
    enabled && indicator === "vulnerabilidad",
  )

  const [levelColors, setLevelColors] = useState<Record<string, string> | null>(null)
  const [vulnColors, setVulnColors] = useState<Record<string, string> | null>(null)

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
          properties: { ...feature.properties, __kind: "pobreza", __height: indicatorHeight(n), __color: levelColors[indicatorLevel(n)] },
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
            __kind: "manzanas",
            __height: indicatorHeight(n, 900),
            __color: levelColors[indicatorLevel(n)],
          },
          geometry: feature.geometry,
        }
      }),
    }
  }, [data, levelColors, manzanaField])

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
            properties: { ...feature.properties, __kind: "vulnerabilidad", __height: height, __color: vulnColors[level] },
            geometry: feature.geometry,
          }
        }),
    }
  }, [vulnerabilidadData, vulnColors])

  const activeGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (indicator === "pobreza") return pobrezaGeoJson
    if (indicator === "manzanas") return manzanasGeoJson
    return vulnerabilidadManzanasGeoJson
  }, [indicator, pobrezaGeoJson, manzanasGeoJson, vulnerabilidadManzanasGeoJson])

  const isLoading = indicator === "vulnerabilidad" ? enabled && !vulnerabilidadData && !vulnerabilidadError : enabled && !data && !geoportalError

  return {
    indicator,
    setIndicator,
    manzanaField,
    setManzanaField,
    pobrezaGeoJson,
    manzanasGeoJson,
    vulnerabilidadManzanasGeoJson,
    activeGeoJson,
    levelColors,
    vulnColors,
    isLoading,
    error: geoportalError ?? vulnerabilidadError ?? null,
  }
}

export type DemografiaExperience = ReturnType<typeof useDemografiaExperience>
