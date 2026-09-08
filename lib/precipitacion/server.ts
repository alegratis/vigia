import "server-only"

import { centroid } from "@turf/centroid"
import { multiPolygon } from "@turf/helpers"
import { getVeredaBoundaries } from "@/lib/veredas/boundaries"
import { getAccumulatedPrecipitationBatch, type AccumulationWindowDays } from "./power-client"
import { getForecastPrecipitationBatch, type ForecastWindowDays } from "./forecast-client"
import { classifyPrecipitation } from "./levels"
import type { PrecipitacionFeatureCollection, PrecipitacionMode } from "./api-types"

export interface GetPrecipitacionAmenazaOptions {
  mode: PrecipitacionMode
  windowDays: number
}

/**
 * Builds the vereda-level precipitación GeoJSON for /api/precipitacion/amenaza:
 * reuses the same vereda boundaries fetched for /api/veredas (see
 * lib/veredas/boundaries.ts), computes each vereda's centroid, then queries
 * either NASA POWER for a backward-looking rainfall accumulation (see
 * lib/precipitacion/power-client.ts) or Open-Meteo for a forward-looking
 * forecast (see lib/precipitacion/forecast-client.ts) once per centroid,
 * and classifies the result into a threat level. Every vereda gets a
 * numeric value here — unlike the susceptibility layers, this data source
 * has no municipio gap, so Zarzal gets the same coverage as Sevilla and
 * Caicedonia.
 */
export async function getPrecipitacionAmenaza({
  mode,
  windowDays,
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
    probabilidadMax: number | undefined,
  ) => ({
    codigoVereda: boundary.codigoVereda,
    nombre: boundary.nombre,
    municipio: boundary.municipio,
    esCascoUrbano: boundary.esCascoUrbano,
    acumuladoMm: accumulatedMm != null ? Math.round(accumulatedMm * 10) / 10 : null,
    diasValidos: validDays ?? 0,
    ...(probabilidadMax != null ? { probabilidadMax: Math.round(probabilidadMax) } : {}),
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
        properties: buildProperties(boundary, f?.accumulatedMm, f?.validDays, f?.probabilidadMax),
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
        properties: buildProperties(boundary, acc?.accumulatedMm, acc?.validDays, undefined),
        geometry: { type: "MultiPolygon", coordinates: boundary.polygons },
      }
    })
  }

  return {
    windowEnd: new Date().toISOString().slice(0, 10),
    veredas: { type: "FeatureCollection", features },
  }
}
