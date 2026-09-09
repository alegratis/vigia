import "server-only"

import { centroid } from "@turf/centroid"
import { multiPolygon } from "@turf/helpers"
import { getVeredaBoundaries } from "@/lib/veredas/boundaries"
import { getAccumulatedPrecipitationBatch, type AccumulationWindowDays } from "./power-client"
import { getForecastPrecipitationBatch, type ForecastWindowDays } from "./forecast-client"
import { getIdeamAccumulationBatch } from "./ideam-client"
import { classifyPrecipitation } from "./levels"
import type { PrecipitacionFeatureCollection, PrecipitacionFuente, PrecipitacionMode } from "./api-types"

export interface GetPrecipitacionAmenazaOptions {
  mode: PrecipitacionMode
  windowDays: number
  /** Historical-only; ignored when mode is "pronostico". */
  fuente: PrecipitacionFuente
}

/**
 * Builds the vereda-level precipitación GeoJSON for /api/precipitacion/amenaza:
 * reuses the same vereda boundaries fetched for /api/veredas (see
 * lib/veredas/boundaries.ts), computes each vereda's centroid, then queries
 * one of three sources once per centroid — NASA POWER or IDEAM stations for
 * a backward-looking accumulation (see power-client.ts / ideam-client.ts),
 * or Open-Meteo for a forward-looking forecast (see forecast-client.ts) —
 * and classifies the result into a threat level. NASA POWER has no
 * municipio gap (Zarzal gets the same coverage as Sevilla and Caicedonia);
 * IDEAM's 2 nearby stations do not reach Sevilla or Caicedonia at all.
 */
export async function getPrecipitacionAmenaza({
  mode,
  windowDays,
  fuente,
}: GetPrecipitacionAmenazaOptions): Promise<{
  windowEnd: string
  veredas: PrecipitacionFeatureCollection
}> {
  const boundaries = await getVeredaBoundaries()

  const centroids = boundaries.map((b) => {
    const [lon, lat] = centroid(multiPolygon(b.polygons)).geometry.coordinates
    return { lon, lat }
  })

  const buildProperties = (
    boundary: (typeof boundaries)[number],
    accumulatedMm: number | undefined,
    validDays: number | undefined,
    extra: { probabilidadMax?: number; estacionNombre?: string; distanciaEstacionKm?: number; sinCobertura?: boolean },
  ) => ({
    codigoVereda: boundary.codigoVereda,
    nombre: boundary.nombre,
    municipio: boundary.municipio,
    esCascoUrbano: boundary.esCascoUrbano,
    acumuladoMm: accumulatedMm != null ? Math.round(accumulatedMm * 10) / 10 : null,
    diasValidos: validDays ?? 0,
    ...(extra.probabilidadMax != null ? { probabilidadMax: Math.round(extra.probabilidadMax) } : {}),
    ...(extra.estacionNombre != null ? { estacionNombre: extra.estacionNombre } : {}),
    ...(extra.distanciaEstacionKm != null ? { distanciaEstacionKm: extra.distanciaEstacionKm } : {}),
    ...(extra.sinCobertura ? { sinCobertura: true } : {}),
    nivel: accumulatedMm != null ? classifyPrecipitation(accumulatedMm, windowDays) : null,
  })

  let features: PrecipitacionFeatureCollection["features"]

  if (mode === "pronostico") {
    const forecasts = await getForecastPrecipitationBatch(centroids, windowDays as ForecastWindowDays)
    features = boundaries.map((boundary, i) => {
      const f = forecasts[i]
      return {
        type: "Feature",
        id: boundary.codigoVereda,
        properties: buildProperties(boundary, f?.accumulatedMm, f?.validDays, { probabilidadMax: f?.probabilidadMax }),
        geometry: { type: "MultiPolygon", coordinates: boundary.polygons },
      }
    })
  } else if (fuente === "ideam") {
    const readings = await getIdeamAccumulationBatch(centroids, windowDays)
    features = boundaries.map((boundary, i) => {
      const r = readings[i]
      return {
        type: "Feature",
        id: boundary.codigoVereda,
        properties: buildProperties(boundary, r?.accumulatedMm, r?.validDays, {
          estacionNombre: r?.estacionNombre,
          distanciaEstacionKm: r?.distanciaEstacionKm,
          sinCobertura: !r,
        }),
        geometry: { type: "MultiPolygon", coordinates: boundary.polygons },
      }
    })
  } else {
    const accumulations = await getAccumulatedPrecipitationBatch(centroids, windowDays as AccumulationWindowDays)
    features = boundaries.map((boundary, i) => {
      const acc = accumulations[i]
      return {
        type: "Feature",
        id: boundary.codigoVereda,
        properties: buildProperties(boundary, acc?.accumulatedMm, acc?.validDays, {}),
        geometry: { type: "MultiPolygon", coordinates: boundary.polygons },
      }
    })
  }

  return {
    windowEnd: new Date().toISOString().slice(0, 10),
    veredas: { type: "FeatureCollection", features },
  }
}

/**
 * Looks up one vereda's centroid by its `codigoVereda`, for
 * /api/precipitacion/climatologia — reuses the same boundaries fetch and
 * centroid math as getPrecipitacionAmenaza above, just for a single vereda
 * rather than all of them.
 */
export async function getVeredaCentroidByCode(
  codigoVereda: string,
): Promise<{ lon: number; lat: number; nombre: string; municipio: string } | null> {
  const boundaries = await getVeredaBoundaries()
  const boundary = boundaries.find((b) => b.codigoVereda === codigoVereda)
  if (!boundary) return null
  const [lon, lat] = centroid(multiPolygon(boundary.polygons)).geometry.coordinates
  return { lon, lat, nombre: boundary.nombre, municipio: boundary.municipio }
}

/**
 * Looks up every rural vereda centroid within one municipio (excluding its
 * "Casco Urbano" pseudo-vereda, which has no rainfall-relevant boundary of
 * its own — it's a point inside one of the rural veredas), for
 * /api/precipitacion/climatologia's "whole territory" mode. Matching is
 * case-insensitive since municipio names arrive title-cased from
 * lib/veredas/boundaries.ts but callers may pass any casing.
 */
export async function getMunicipioCentroids(
  municipio: string,
): Promise<{ centroids: Array<{ lon: number; lat: number }>; nombre: string } | null> {
  const boundaries = await getVeredaBoundaries()
  const target = municipio.trim().toLowerCase()
  const matches = boundaries.filter((b) => !b.esCascoUrbano && b.municipio.toLowerCase() === target)
  if (matches.length === 0) return null
  const centroids = matches.map((b) => {
    const [lon, lat] = centroid(multiPolygon(b.polygons)).geometry.coordinates
    return { lon, lat }
  })
  return { centroids, nombre: matches[0].municipio }
}
