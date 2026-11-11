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

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import { useBarrios } from "@/lib/barrios/use-barrios"
import type { BarrioFeature, BarrioProperties } from "@/lib/barrios/api-types"
import { ipmForVereda } from "@/lib/demografia/ipm-municipal"
import { useDemografiaGeoportal } from "@/lib/demografia/use-geoportal"
import { useVeredas } from "@/lib/veredas/use-veredas"
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

export type DemografiaIndicator = "vulnerabilidad" | "pobreza" | "manzanas" | "ipm-municipal"
export type ManzanaField = "viviendas" | "hogares" | "personas"

export const MANZANA_FIELD_LABEL: Record<ManzanaField, string> = {
  viviendas: "Viviendas",
  hogares: "Hogares",
  personas: "Personas",
}

/** Single stable id pair reused across every indicator — only one is ever rendered at once (demografía is exclusive), and keeping the id constant across indicator switches avoids react-map-gl reusing the same JSX-position `<Layer>` with a changed `id`, which trips MapLibre's own "id/type never change in place" assertion (see lab-map.tsx's preview-source fix for the same failure mode). */
export const DEMOGRAFIA_SOURCE_ID = "lab-demografia-source"
export const DEMOGRAFIA_LAYER_ID = "lab-demografia-columns"

export const BARRIOS_SOURCE_ID = "lab-barrios-source"
export const BARRIOS_FILL_LAYER_ID = "lab-barrios-fill"
export const BARRIOS_LINE_LAYER_ID = "lab-barrios-line"

/**
 * @param enabled Only fetches/computes while the demografía layer is
 * actually focused — same lazy-fetch convention as `useHidrantesExperience`.
 */
export function useDemografiaExperience(enabled: boolean) {
  const [indicator, setIndicatorState] = useState<DemografiaIndicator>("vulnerabilidad")
  const [manzanaField, setManzanaField] = useState<ManzanaField>("personas")

  const userPickedIndicator = useRef(false)
  const setIndicator = useCallback((next: DemografiaIndicator) => {
    userPickedIndicator.current = true
    setIndicatorState(next)
  }, [])

  const { data, error: geoportalError } = useDemografiaGeoportal(
    enabled && (indicator === "pobreza" || indicator === "manzanas"),
  )
  const { data: vulnerabilidadData, error: vulnerabilidadError } = useVulnerabilidad(
    enabled && indicator === "vulnerabilidad",
  )
  const { veredas, error: veredasError } = useVeredas(enabled && indicator === "ipm-municipal")

  // Si el indicador por defecto no carga y nadie eligió otro, se pasa al IPM municipal, que no depende
  // de las manzanas del geoportal, en lugar de dejar la pestaña con un error.
  useEffect(() => {
    if (enabled && !userPickedIndicator.current && indicator === "vulnerabilidad" && vulnerabilidadError) {
      setIndicatorState("ipm-municipal")
    }
  }, [enabled, indicator, vulnerabilidadError])

  // Sevilla's only published barrio layer (SIRD dashboard). Fetched whenever demografía is focused,
  // even with the outlines hidden, because every popup resolves "which barrio is this?" from it.
  const [showBarrios, setShowBarrios] = useState(true)
  const { data: barriosData } = useBarrios(enabled)

  const barriosGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!barriosData) return { type: "FeatureCollection", features: [] }
    return {
      type: "FeatureCollection",
      features: barriosData.barrios.features.map((f) => ({
        type: "Feature",
        properties: { ...f.properties, __kind: "barrio" },
        geometry: f.geometry,
      })),
    }
  }, [barriosData])

  const findBarrioAt = useCallback(
    (lon: number, lat: number): BarrioProperties | null => {
      if (!barriosData) return null
      const hit = barriosData.barrios.features.find((f: BarrioFeature) => booleanPointInPolygon([lon, lat], f.geometry))
      return hit?.properties ?? null
    },
    [barriosData],
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

  // Cada vereda toma el IPM de su municipio y zona (cabecera para el casco urbano, rural para el resto):
  // el dato censal más fino que existe sin las manzanas del geoportal.
  const ipmMunicipalGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!veredas || !levelColors) return { type: "FeatureCollection", features: [] }
    const rows = veredas.features.flatMap((feature) => {
      const value = ipmForVereda(feature.properties.municipio, feature.properties.esCascoUrbano === true)
      return value ? [{ feature, value }] : []
    })
    const values = rows.map((row) => row.value.ipm)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    return {
      type: "FeatureCollection",
      features: rows.map(({ feature, value }, i) => {
        const n = normalize(value.ipm, min, max)
        return {
          type: "Feature",
          id: i,
          properties: {
            codigoVereda: feature.properties.codigoVereda,
            nombre: feature.properties.nombre,
            municipio: feature.properties.municipio,
            esCascoUrbano: feature.properties.esCascoUrbano === true,
            ipm: value.ipm,
            ipmMunicipal: value.ipmMunicipal,
            __kind: "ipm-municipal",
            __height: indicatorHeight(n),
            __color: levelColors[indicatorLevel(n)],
          },
          geometry: feature.geometry,
        }
      }),
    }
  }, [veredas, levelColors])

  const activeGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    if (indicator === "pobreza") return pobrezaGeoJson
    if (indicator === "manzanas") return manzanasGeoJson
    if (indicator === "ipm-municipal") return ipmMunicipalGeoJson
    return vulnerabilidadManzanasGeoJson
  }, [indicator, pobrezaGeoJson, manzanasGeoJson, ipmMunicipalGeoJson, vulnerabilidadManzanasGeoJson])

  const isLoading =
    indicator === "vulnerabilidad"
      ? enabled && !vulnerabilidadData && !vulnerabilidadError
      : indicator === "ipm-municipal"
        ? enabled && !veredas && !veredasError
        : enabled && !data && !geoportalError

  return {
    indicator,
    setIndicator,
    manzanaField,
    setManzanaField,
    pobrezaGeoJson,
    manzanasGeoJson,
    vulnerabilidadManzanasGeoJson,
    activeGeoJson,
    showBarrios,
    setShowBarrios,
    barriosGeoJson,
    findBarrioAt,
    levelColors,
    vulnColors,
    isLoading,
    error: geoportalError ?? vulnerabilidadError ?? veredasError ?? null,
  }
}

export type DemografiaExperience = ReturnType<typeof useDemografiaExperience>
