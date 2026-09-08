import "server-only"

import { centroid } from "@turf/centroid"
import { multiPolygon } from "@turf/helpers"
import { getVeredaBoundaries } from "@/lib/veredas/boundaries"
import { getAccumulatedPrecipitationBatch } from "./power-client"
import { classifyPrecipitation } from "./levels"
import type { PrecipitacionFeatureCollection } from "./api-types"

/**
 * Builds the vereda-level precipitación GeoJSON for /api/precipitacion/amenaza:
 * reuses the same vereda boundaries fetched for /api/veredas (see
 * lib/veredas/boundaries.ts), computes each vereda's centroid, queries NASA
 * POWER once per centroid for a 7-day rainfall accumulation (see
 * lib/precipitacion/power-client.ts), and classifies the result into a
 * threat level. Every vereda gets a numeric value here — unlike the
 * susceptibility layers, this data source has no municipio gap, so Zarzal
 * gets the same coverage as Sevilla and Caicedonia.
 */
export async function getPrecipitacionAmenaza(): Promise<{
  windowEnd: string
  veredas: PrecipitacionFeatureCollection
}> {
  const boundaries = await getVeredaBoundaries()

  const centroids = boundaries.map((b) => {
    const [lon, lat] = centroid(multiPolygon(b.polygons)).geometry.coordinates
    return { lon, lat }
  })

  const accumulations = await getAccumulatedPrecipitationBatch(centroids)

  const features: PrecipitacionFeatureCollection["features"] = boundaries.map((boundary, i) => {
    const acc = accumulations[i]
    return {
      type: "Feature",
      id: boundary.codigoVereda,
      properties: {
        codigoVereda: boundary.codigoVereda,
        nombre: boundary.nombre,
        municipio: boundary.municipio,
        esCascoUrbano: boundary.esCascoUrbano,
        acumuladoMm: acc ? Math.round(acc.accumulatedMm * 10) / 10 : null,
        diasValidos: acc?.validDays ?? 0,
        nivel: acc ? classifyPrecipitation(acc.accumulatedMm) : null,
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: boundary.polygons,
      },
    }
  })

  return {
    windowEnd: new Date().toISOString().slice(0, 10),
    veredas: { type: "FeatureCollection", features },
  }
}
