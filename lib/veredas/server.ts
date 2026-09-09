import "server-only"

import { getVeredaBoundaries } from "./boundaries"
import { aggregateVeredas } from "./aggregate"
import type { VeredasFeatureCollection } from "./api-types"

/**
 * Builds the full vereda boundary + hazard-summary GeoJSON for /api/veredas:
 * fetches boundaries from lib/veredas/boundaries.ts, spatially aggregates
 * susceptibility and sitios-críticos data onto them, and zips the two into
 * one FeatureCollection ready to render as a choropleth overlay.
 */
export async function getVeredas(): Promise<VeredasFeatureCollection> {
  const boundaries = await getVeredaBoundaries()
  const aggregates = await aggregateVeredas(boundaries)

  const features: VeredasFeatureCollection["features"] = boundaries.map((boundary) => {
    const agg = aggregates.get(boundary.codigoVereda)
    return {
      type: "Feature",
      id: boundary.codigoVereda,
      properties: {
        codigoVereda: boundary.codigoVereda,
        nombre: boundary.nombre,
        municipio: boundary.municipio,
        esCascoUrbano: boundary.esCascoUrbano,
        isScoreAvg: agg?.isScoreAvg ?? null,
        dominantLevel: agg?.dominantLevel ?? null,
        slopeDeg: agg?.slopeDeg ?? null,
        roadDistanceKm: agg?.roadDistanceKm ?? null,
        faultDistanceKm: agg?.faultDistanceKm ?? null,
        rainfallRatio: agg?.rainfallRatio ?? null,
        puntosMuestra: agg?.puntosMuestra ?? 0,
        poblacion: agg?.poblacion ?? null,
        poblacionMenores5: agg?.poblacionMenores5 ?? null,
        poblacionMayores60: agg?.poblacionMayores60 ?? null,
        escuelas: agg?.escuelas ?? null,
        hospitales: agg?.hospitales ?? null,
        farmacias: agg?.farmacias ?? null,
        infraestructuraCritica: agg?.infraestructuraCritica ?? null,
        sitiosCriticos: agg?.sitiosCriticos ?? 0,
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: boundary.polygons,
      },
    }
  })

  return { type: "FeatureCollection", features }
}
