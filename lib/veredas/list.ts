import "server-only"

import { getVeredaBoundaries } from "./tiles"
import type { VeredaListEntry } from "./list-api-types"

/**
 * Builds the lightweight vereda index for /api/veredas/lista: just the
 * boundary decode from lib/veredas/tiles.ts (35 vector tiles, cached a
 * week), with a derived bbox + centroid per vereda alongside its raw
 * boundary geometry. Skips the hazard aggregation in
 * lib/veredas/aggregate.ts entirely — the municipio/vereda picker only
 * needs to list names and fit/outline a map to a boundary, not
 * point-in-polygon test ~11,800 susceptibility points.
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
        bbox: [south, west, north, east],
        center: [(south + north) / 2, (west + east) / 2],
        polygons: boundary.polygons,
      }
      return entry
    })
    .filter((entry): entry is VeredaListEntry => entry !== null)
    .sort((a, b) => a.municipio.localeCompare(b.municipio) || a.nombre.localeCompare(b.nombre))
}
