import "server-only"

/**
 * Spatially aggregates data this app already fetches at the point or
 * municipio level onto the finer-grained vereda boundaries decoded in
 * lib/veredas/tiles.ts, via point-in-polygon tests (turf).
 *
 * Two independent sources, both restricted to their own municipio before
 * testing (cheap prefilter, and the honest thing to do — a Sevilla grid
 * point should never count toward a Caicedonia vereda even if it were
 * geometrically close to the border):
 *
 * - `VIGIA_Amenaza_IS_Puntos` susceptibility grid (~11,721 points, Sevilla +
 *   Caicedonia only — see lib/deslizamientos/client.ts): each point already
 *   carries a population/infrastructure count for its own small area, the
 *   same fields `getPopulationByLevel`/`getExposureByLevel` sum by threat
 *   level. Summing them by vereda instead is the same data, finer grain —
 *   not a new or estimated number.
 * - "Sitios críticos" field survey (94 points across all three
 *   municipios — see lib/deslizamientos/critical-sites.ts).
 *
 * Zarzal has no records in the susceptibility layer at all (flat valley
 * floor, out of scope for that model), so its veredas get `null` for every
 * susceptibility/population/infrastructure field — never a fabricated or
 * estimated value — while still getting a sitios-críticos count.
 */

import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon"
import { multiPolygon, point } from "@turf/helpers"
import { getSusceptibilityPointsForAggregation } from "@/lib/deslizamientos/client"
import { getCriticalSites } from "@/lib/deslizamientos/critical-sites"
import { SUSCEPTIBILITY_LEVELS, type SusceptibilityLevel } from "@/lib/deslizamientos/levels"
import type { VeredaBoundary } from "./tiles"

export interface VeredaAggregate {
  isScoreAvg: number | null
  dominantLevel: SusceptibilityLevel | null
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
 * Aggregates susceptibility and sitios-críticos data onto each vereda
 * boundary. Returns a Map keyed by `codigoVereda` so the caller can zip it
 * back onto the boundary list when building the final GeoJSON response.
 */
export async function aggregateVeredas(
  boundaries: VeredaBoundary[],
): Promise<Map<string, VeredaAggregate>> {
  const [susceptibilityPoints, criticalSites] = await Promise.all([
    getSusceptibilityPointsForAggregation(),
    getCriticalSites(),
  ])

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
        isScoreAvg: null,
        dominantLevel: null,
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

    const levelCounts = new Map<SusceptibilityLevel, number>()
    let scoreSum = 0
    let scoreCount = 0
    let poblacion = 0
    let poblacionMenores5 = 0
    let poblacionMayores60 = 0
    let escuelas = 0
    let hospitales = 0
    let farmacias = 0
    let infraestructuraCritica = 0

    for (const p of insidePoints) {
      levelCounts.set(p.level, (levelCounts.get(p.level) ?? 0) + 1)
      if (p.isScore != null) {
        scoreSum += p.isScore
        scoreCount += 1
      }
      poblacion += p.pobGen
      poblacionMenores5 += p.pobMen5
      poblacionMayores60 += p.pobMay60
      escuelas += p.nEscuelas
      hospitales += p.nHospit
      farmacias += p.nFarmaci
      infraestructuraCritica += p.infraCrit
    }

    let dominantLevel: SusceptibilityLevel | null = null
    let dominantCount = -1
    // Ties break toward the higher-severity level (SUSCEPTIBILITY_LEVELS is
    // ordered low → high) rather than whichever level happened to be
    // inserted first — a vereda evenly split shouldn't read as the milder
    // of its two dominant levels.
    for (const level of SUSCEPTIBILITY_LEVELS) {
      const count = levelCounts.get(level) ?? 0
      if (count >= dominantCount && count > 0) {
        dominantCount = count
        dominantLevel = level
      }
    }

    result.set(boundary.codigoVereda, {
      isScoreAvg: scoreCount > 0 ? scoreSum / scoreCount : null,
      dominantLevel,
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
