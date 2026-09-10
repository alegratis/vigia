import "server-only"

/**
 * Builds the vereda-level compound-risk GeoJSON for
 * /api/riesgo-compuesto/veredas. Pure composition of existing exports —
 * no per-category server file is modified:
 *
 * - `getVeredaBoundaries()` + `aggregateVeredas()` (lib/veredas/*) already
 *   give the deslizamientos and inundaciones (own model) hazard levels/
 *   scores, plus every demographics field, per vereda.
 * - `joinFireThreatToVeredas()` (this category's own new join) resolves
 *   incendios at the same centroids.
 * - `getPrecipitacionAmenaza()` (lib/precipitacion/server.ts), run once
 *   in its existing 7-day/NASA POWER historical mode, resolves
 *   precipitación at the same vereda granularity it already supports.
 * - `getSeismicExposureByVereda()` (lib/sismologia/exposure-score.ts)
 *   resolves sismología at the same centroids via distance-decay from
 *   USGS/SGC epicenters — the one hazard here with no published zonation
 *   to join against instead.
 *
 * GEOGLOWS live river forecasts are intentionally NOT folded in here —
 * see the methodology section in /documentacion for why.
 */

import { centroid } from "@turf/centroid"
import { multiPolygon } from "@turf/helpers"
import { getVeredaBoundaries } from "@/lib/veredas/boundaries"
import { aggregateVeredas } from "@/lib/veredas/aggregate"
import { getPrecipitacionAmenaza } from "@/lib/precipitacion/server"
import { isPrecipitationLevel } from "@/lib/precipitacion/levels"
import { getSeismicExposureByVereda } from "@/lib/sismologia/exposure-score"
import { joinFireThreatToVeredas } from "./incendios-join"
import { computeCompoundVeredaRisk } from "./compound-model"
import { actionTierFor } from "./levels"
import { buildNarrative } from "./narrative"
import type { CompoundFeatureCollection } from "./api-types"

export async function getRiesgoCompuestoVeredas(): Promise<CompoundFeatureCollection> {
  const boundaries = await getVeredaBoundaries()

  const [aggregates, precipitacion] = await Promise.all([
    aggregateVeredas(boundaries),
    getPrecipitacionAmenaza({ mode: "historico", windowDays: 7, fuente: "power" }),
  ])

  const centroids = boundaries.map((b) => {
    const [lon, lat] = centroid(multiPolygon(b.polygons)).geometry.coordinates
    return { codigoVereda: b.codigoVereda, lat, lon }
  })
  const [fireByVereda, seismicByVereda] = await Promise.all([
    joinFireThreatToVeredas(centroids),
    getSeismicExposureByVereda(centroids),
  ])

  const precipByVereda = new Map(
    precipitacion.veredas.features.map((f) => [f.properties.codigoVereda, f.properties]),
  )

  const features: CompoundFeatureCollection["features"] = boundaries.map((boundary) => {
    const agg = aggregates.get(boundary.codigoVereda) ?? null
    const fireLevel = fireByVereda.get(boundary.codigoVereda) ?? null
    const precip = precipByVereda.get(boundary.codigoVereda) ?? null
    const precipLevel = precip?.nivel != null && isPrecipitationLevel(precip.nivel) ? precip.nivel : null
    const seismic = seismicByVereda.get(boundary.codigoVereda) ?? null

    const { compoundLevel, compoundScore, dominantHazard, subHazards } = computeCompoundVeredaRisk({
      deslizamientos: { level: agg?.dominantLevel ?? null, score: agg?.isScoreAvg ?? null },
      inundaciones: { level: agg?.floodLevel ?? null, score: agg?.floodScoreAvg ?? null },
      incendios: { level: fireLevel },
      precipitacion: { level: precipLevel, accumulatedMm: precip?.acumuladoMm ?? null },
      sismologia: { score: seismic?.score ?? null },
    })

    // Fill in each sub-hazard's contributing-factor detail from data already computed for it —
    // computeCompoundVeredaRisk() itself has no access to these underlying factor values.
    for (const sub of subHazards) {
      if (sub.hazard === "deslizamientos" && agg?.slopeDeg != null) {
        sub.detail = `Pendiente: ${agg.slopeDeg.toFixed(1)}°`
      } else if (sub.hazard === "inundaciones" && agg?.floodStreamDistanceKm != null) {
        sub.detail = `Quebrada más cercana: ${agg.floodStreamDistanceKm.toFixed(2)} km`
      } else if (sub.hazard === "precipitacion" && precip?.acumuladoMm != null) {
        sub.detail = `Acumulado 7 días: ${precip.acumuladoMm.toFixed(1)} mm`
      } else if (sub.hazard === "sismologia" && seismic?.nearestEventKm != null) {
        sub.detail = `Evento más cercano: ${seismic.nearestEventKm.toFixed(1)} km (M ${seismic.nearestEventMagnitude?.toFixed(1) ?? "—"})`
      }
    }

    const actionTier = compoundLevel ? actionTierFor(compoundLevel) : null

    const narrative = buildNarrative({
      nombre: boundary.nombre,
      municipio: boundary.municipio,
      compoundLevel,
      actionTier,
      dominantHazard,
      subHazards,
      poblacion: agg?.poblacion ?? null,
      escuelas: agg?.escuelas ?? null,
      hospitales: agg?.hospitales ?? null,
      farmacias: agg?.farmacias ?? null,
      infraestructuraCritica: agg?.infraestructuraCritica ?? null,
      sitiosCriticos: agg?.sitiosCriticos ?? 0,
    })

    return {
      type: "Feature",
      id: boundary.codigoVereda,
      properties: {
        codigoVereda: boundary.codigoVereda,
        nombre: boundary.nombre,
        municipio: boundary.municipio,
        esCascoUrbano: boundary.esCascoUrbano,
        compoundLevel,
        compoundScore,
        actionTier,
        dominantHazard,
        subHazards,
        poblacion: agg?.poblacion ?? null,
        poblacionMenores5: agg?.poblacionMenores5 ?? null,
        poblacionMayores60: agg?.poblacionMayores60 ?? null,
        escuelas: agg?.escuelas ?? null,
        hospitales: agg?.hospitales ?? null,
        farmacias: agg?.farmacias ?? null,
        infraestructuraCritica: agg?.infraestructuraCritica ?? null,
        sitiosCriticos: agg?.sitiosCriticos ?? 0,
        narrative,
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: boundary.polygons,
      },
    }
  })

  return { type: "FeatureCollection", features }
}
