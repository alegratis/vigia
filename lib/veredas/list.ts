import "server-only"

import { getVeredaBoundaries } from "./boundaries"
import type { VeredaListEntry } from "./list-api-types"

/**
 * Builds the lightweight vereda index for /api/veredas/lista: just the
 * boundary fetch from lib/veredas/boundaries.ts (cached a week), with a
 * derived bbox + centroid per vereda alongside its raw boundary geometry.
 * Skips the hazard aggregation in lib/veredas/aggregate.ts entirely — the
 * municipio/vereda picker only needs to list names and fit/outline a map
 * to a boundary, not point-in-polygon test ~11,800 susceptibility points.
 */
export async function getVeredaList(): Promise<VeredaListEntry[]> {
  const boundaries = await getVeredaBoundaries()

  return boundaries
    .map((boundary) => {
      let south = Infinity
      let west = Infinity
      let north = -Infinity
      let east = -Infinity

      for (const polygon of boundary.polygons) {
        for (const ring of polygon) {
          for (const [lon, lat] of ring) {
            if (lat < south) south = lat
            if (lat > north) north = lat
            if (lon < west) west = lon
            if (lon > east) east = lon
          }
        }
      }

      if (!Number.isFinite(south) || !Number.isFinite(west)) return null

      const entry: VeredaListEntry = {
        codigoVereda: boundary.codigoVereda,
        nombre: boundary.nombre,
        municipio: boundary.municipio,
        esCascoUrbano: boundary.esCascoUrbano,
        bbox: [south, west, north, east],
        center: [(south + north) / 2, (west + east) / 2],
        polygons: boundary.polygons,
      }
      return entry
    })
    .filter((entry): entry is VeredaListEntry => entry !== null)
    .sort(
      (a, b) =>
        a.municipio.localeCompare(b.municipio) ||
        // Pin each municipio's "Casco Urbano" pseudo-vereda first, ahead of
        // its alphabetically-sorted rural veredas, so it's easy to find.
        Number(!!b.esCascoUrbano) - Number(!!a.esCascoUrbano) ||
        a.nombre.localeCompare(b.nombre),
    )
}
