import type { LatLngBoundsExpression } from "leaflet"
import { isMunicipioActive } from "@/lib/veredas/municipio-toggles"

/**
 * Minimal shape shared by every vereda feature collection in the app
 * (the plain `/api/veredas` payload and the richer compound-risk
 * payload alike) — just enough to locate a municipio's boundary and
 * fly the map there. Kept structural on purpose so callers don't need
 * to reconcile the differing `properties`/`geometry` types between
 * those payloads.
 */
interface MunicipioBoundableFeature {
  properties: { municipio: string }
  geometry: { coordinates: number[][][][] }
}

interface MunicipioBoundableCollection {
  features: MunicipioBoundableFeature[]
}

/**
 * Computes a Leaflet bounds box covering every vereda belonging to the
 * given active municipios, by walking each feature's raw
 * `[lon, lat]` MultiPolygon coordinates. Returns `null` when there's
 * nothing to bound (no veredas loaded yet, or an empty/"all" selection —
 * flying to the full AOI on every-municipio-active isn't useful).
 */
export function boundsForActiveMunicipios(
  veredas: MunicipioBoundableCollection | null | undefined,
  activeMunicipios: string[],
): LatLngBoundsExpression | null {
  if (!veredas || activeMunicipios.length === 0) return null

  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity
  let found = false

  const scan = (feature: MunicipioBoundableFeature) => {
    if (!isMunicipioActive(feature.properties.municipio, activeMunicipios)) return
    for (const polygon of feature.geometry.coordinates) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          found = true
          if (lat > north) north = lat
          if (lat < south) south = lat
          if (lon > east) east = lon
          if (lon < west) west = lon
        }
      }
    }
  }

  for (const feature of veredas.features) scan(feature)

  if (!found) return null
  return [
    [south, west],
    [north, east],
  ]
}
