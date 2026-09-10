import "server-only"

/**
 * Spatially aggregates data this app already fetches at the point or
 * municipio level onto the finer-grained vereda boundaries fetched in
 * lib/veredas/boundaries.ts, via point-in-polygon tests (turf), and
 * combines it with this app's own per-vereda hazard model.
 *
 * Three independent sources:
 *
 * - `VIGIA_Amenaza_IS_Puntos` population/infrastructure grid (~11,721
 *   points, Sevilla + Caicedonia only — see lib/deslizamientos/client.ts),
 *   restricted to its own municipio before testing (cheap prefilter, and
 *   the honest thing to do — a Sevilla grid point should never count
 *   toward a Caicedonia vereda even if it were geometrically close to the
 *   border): each point already carries a population/infrastructure count
 *   for its own small area, the same fields
 *   `getPopulationByLevel`/`getExposureByLevel` sum by threat level.
 *   Summing them by vereda instead is the same data, finer grain — not a
 *   new or estimated number. This is the *only* remaining use of the RED
 *   LabOT layer here: its own susceptibility level/score are no longer
 *   used for `dominantLevel`/`isScoreAvg` below (see next point), since
 *   there's no equivalent per-vereda population source to fall back to if
 *   this layer's population counts were dropped instead.
 * - This app's own hazard model (lib/deslizamientos/hazard-model.ts) —
 *   slope + road proximity + a rainfall-anomaly trigger — computed once
 *   per vereda centroid rather than aggregated from a grid, and covering
 *   all three municipios, including Zarzal (which the RED LabOT layer
 *   never had zones for at all).
 * - "Sitios críticos" field survey (94 points across all three
 *   municipios — see lib/deslizamientos/critical-sites.ts).
 *
 * Zarzal has no records in the RED LabOT population grid (flat valley
 * floor, out of scope for that layer), so its veredas get `null` for
 * every population/infrastructure field — never a fabricated or estimated
 * value — while still getting a hazard level and a sitios-críticos count.
 *
 * A fourth, independent source follows the same "own model, computed at
 * each vereda's centroid" pattern as the landslide hazard model: this
 * app's own flood-susceptibility model (lib/inundaciones/hazard-model.ts —
 * official zoning + stream proximity + terrain flatness), also covering
 * all three municipios including Zarzal. It reuses each centroid's
 * `slopeDeg` already computed by `computeVeredaHazard` above, rather than
 * re-fetching elevation a second time for the same point.
 */

import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon"
import { centroid } from "@turf/centroid"
import { multiPolygon, point } from "@turf/helpers"
import { getSusceptibilityPointsForAggregation } from "@/lib/deslizamientos/client"
import { getCriticalSites } from "@/lib/deslizamientos/critical-sites"
import { computeVeredaHazard } from "@/lib/deslizamientos/hazard-model"
import type { SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import { computeVeredaFloodHazard } from "@/lib/inundaciones/hazard-model"
import type { FloodSusceptibilityLevel } from "@/lib/inundaciones/levels"
import type { VeredaBoundary } from "./boundaries"

export interface VeredaAggregate {
  isScoreAvg: number | null
  dominantLevel: SusceptibilityLevel | null
  /** Terrain slope (degrees) at this vereda's centroid — see hazard-model.ts. */
  slopeDeg: number | null
  /** Distance (km) from this vereda's centroid to the nearest OSM road — see hazard-model.ts. */
  roadDistanceKm: number | null
  /** Distance (km) from this vereda's centroid to the nearest mapped geological fault (SGC) — see hazard-model.ts. */
  faultDistanceKm: number | null
  /** Distance (km) from this vereda's centroid to the nearest documented historical mass movement (SGC inventory) — see hazard-model.ts. */
  historyDistanceKm: number | null
  /** Current antecedent-rainfall index over its 3-year same-season baseline — see hazard-model.ts. */
  rainfallRatio: number | null

  /** Final 0–1 composite score from this app's own flood hazard model — see lib/inundaciones/hazard-model.ts. */
  floodScoreAvg: number | null
  floodLevel: FloodSusceptibilityLevel | null
  /** Distance (km) from this vereda's centroid to the nearest named stream/creek trace. */
  floodStreamDistanceKm: number | null
  /** Official zoning class at this centroid, or `null` outside the zoning layer's coverage (every vereda in Zarzal). */
  floodZoningLevel: FloodSusceptibilityLevel | null
  floodZoningCovered: boolean

  puntosMuestra: number
  poblacion: number | null
  poblacionMenores5: number | null
  poblacionMayores60: number | null
  escuelas: number | null
  hospitales: number | null
  farmacias: number | null
  infraestructuraCritica: number | null
  sitiosCriticos: number
}

type Bbox = readonly [number, number, number, number] // [minLon, minLat, maxLon, maxLat]

function computeBbox(polygons: number[][][][]): Bbox {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const poly of polygons) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon
        if (lon > maxLon) maxLon = lon
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }
  return [minLon, minLat, maxLon, maxLat]
}

function inBbox(lon: number, lat: number, bbox: Bbox): boolean {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3]
}

/**
 * Aggregates RED LabOT population/infrastructure data and sitios-críticos
 * onto each vereda boundary, and merges in this app's own per-vereda
 * hazard model. Returns a Map keyed by `codigoVereda` so the caller can
 * zip it back onto the boundary list when building the final GeoJSON
 * response.
 */
export async function aggregateVeredas(
  boundaries: VeredaBoundary[],
): Promise<Map<string, VeredaAggregate>> {
  const centroids = boundaries.map((boundary) => {
    const [lon, lat] = centroid(multiPolygon(boundary.polygons)).geometry.coordinates
    return { codigoVereda: boundary.codigoVereda, lat, lon }
  })

  const [susceptibilityPoints, criticalSites, hazardByVereda] = await Promise.all([
    getSusceptibilityPointsForAggregation(),
    getCriticalSites(),
    computeVeredaHazard(centroids),
  ])

  // Flood centroids reuse each vereda's slope from the landslide hazard
  // result above instead of a second elevation fetch for the same point.
  const floodCentroids = centroids.map((c) => ({
    ...c,
    slopeDeg: hazardByVereda.get(c.codigoVereda)?.slopeDeg ?? null,
  }))
  const floodHazardByVereda = await computeVeredaFloodHazard(floodCentroids)

  const pointsByMunicipio = new Map<string, typeof susceptibilityPoints>()
  for (const p of susceptibilityPoints) {
    const list = pointsByMunicipio.get(p.municipio)
    if (list) list.push(p)
    else pointsByMunicipio.set(p.municipio, [p])
  }

  const sitesByMunicipio = new Map<string, typeof criticalSites>()
  for (const s of criticalSites) {
    const list = sitesByMunicipio.get(s.municipio)
    if (list) list.push(s)
    else sitesByMunicipio.set(s.municipio, [s])
  }

  const result = new Map<string, VeredaAggregate>()

  for (const boundary of boundaries) {
    const bbox = computeBbox(boundary.polygons)
    const poly = multiPolygon(boundary.polygons)
    const hazard = hazardByVereda.get(boundary.codigoVereda) ?? null
    const floodHazard = floodHazardByVereda.get(boundary.codigoVereda) ?? null

    const candidatePoints = pointsByMunicipio.get(boundary.municipio) ?? []
    const insidePoints = candidatePoints.filter(
      (p) => inBbox(p.lon, p.lat, bbox) && booleanPointInPolygon(point([p.lon, p.lat]), poly),
    )

    const candidateSites = sitesByMunicipio.get(boundary.municipio) ?? []
    const sitiosCriticos = candidateSites.filter(
      (s) => inBbox(s.lon, s.lat, bbox) && booleanPointInPolygon(point([s.lon, s.lat]), poly),
    ).length

    if (insidePoints.length === 0) {
      result.set(boundary.codigoVereda, {
        isScoreAvg: hazard?.score ?? null,
        dominantLevel: hazard?.level ?? null,
        slopeDeg: hazard?.slopeDeg ?? null,
        roadDistanceKm: hazard?.roadDistanceKm ?? null,
        faultDistanceKm: hazard?.faultDistanceKm ?? null,
        historyDistanceKm: hazard?.historyDistanceKm ?? null,
        rainfallRatio: hazard?.rainfallRatio ?? null,
        floodScoreAvg: floodHazard?.score ?? null,
        floodLevel: floodHazard?.level ?? null,
        floodStreamDistanceKm: floodHazard?.streamDistanceKm ?? null,
        floodZoningLevel: floodHazard?.zoningLevel ?? null,
        floodZoningCovered: floodHazard?.zoningCovered ?? false,
        puntosMuestra: 0,
        poblacion: null,
        poblacionMenores5: null,
        poblacionMayores60: null,
        escuelas: null,
        hospitales: null,
        farmacias: null,
        infraestructuraCritica: null,
        sitiosCriticos,
      })
      continue
    }

    let poblacion = 0
    let poblacionMenores5 = 0
    let poblacionMayores60 = 0
    let escuelas = 0
    let hospitales = 0
    let farmacias = 0
    let infraestructuraCritica = 0

    for (const p of insidePoints) {
      poblacion += p.pobGen
      poblacionMenores5 += p.pobMen5
      poblacionMayores60 += p.pobMay60
      escuelas += p.nEscuelas
      hospitales += p.nHospit
      farmacias += p.nFarmaci
      infraestructuraCritica += p.infraCrit
    }

    result.set(boundary.codigoVereda, {
      isScoreAvg: hazard?.score ?? null,
      dominantLevel: hazard?.level ?? null,
      slopeDeg: hazard?.slopeDeg ?? null,
      roadDistanceKm: hazard?.roadDistanceKm ?? null,
      faultDistanceKm: hazard?.faultDistanceKm ?? null,
      historyDistanceKm: hazard?.historyDistanceKm ?? null,
      rainfallRatio: hazard?.rainfallRatio ?? null,
      floodScoreAvg: floodHazard?.score ?? null,
      floodLevel: floodHazard?.level ?? null,
      floodStreamDistanceKm: floodHazard?.streamDistanceKm ?? null,
      floodZoningLevel: floodHazard?.zoningLevel ?? null,
      floodZoningCovered: floodHazard?.zoningCovered ?? false,
      puntosMuestra: insidePoints.length,
      poblacion,
      poblacionMenores5,
      poblacionMayores60,
      escuelas,
      hospitales,
      farmacias,
      infraestructuraCritica,
      sitiosCriticos,
    })
  }

  return result
}
