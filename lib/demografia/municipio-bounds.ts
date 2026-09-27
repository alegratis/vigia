import { normalizeMunicipioName } from "./categories"

interface MunicipioBoundableFeature {
  properties: { municipio?: string | null } | null
  geometry: GeoJSON.Geometry
}

interface MunicipioBoundableCollection {
  features: MunicipioBoundableFeature[]
}

/**
 * Recursively walks a GeoJSON Polygon or MultiPolygon's coordinate nesting
 * down to individual `[lon, lat]` points, regardless of which of the two it
 * is — unlike `lib/veredas/municipio-bounds.ts` (which assumes a flat
 * MultiPolygon ring-set), demografía's manzana-grain sources are plain
 * Polygons, so this has to handle either nesting depth.
 */
function walkPoints(coords: unknown, visit: (lon: number, lat: number) => void) {
  if (!Array.isArray(coords)) return
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    visit(coords[0] as number, coords[1] as number)
    return
  }
  for (const child of coords) walkPoints(child, visit)
}

/**
 * Bounding box for the given municipios across any of demografía's own
 * feature collections (pobreza, vulnerabilidad manzanas, barrios) — used to
 * zoom the map when the "Municipios" toggle selection changes.
 */
export function boundsForActiveMunicipios(
  collection: MunicipioBoundableCollection | null | undefined,
  activeMunicipios: string[],
): [[number, number], [number, number]] | null {
  if (!collection || activeMunicipios.length === 0) return null
  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity
  let found = false

  for (const feature of collection.features) {
    const raw = feature.properties?.municipio
    if (!raw) continue
    const canonical = normalizeMunicipioName(raw)
    if (!activeMunicipios.some((m) => m.toLowerCase() === canonical.toLowerCase())) continue
    const coordinates = "coordinates" in feature.geometry ? feature.geometry.coordinates : null
    if (!coordinates) continue
    walkPoints(coordinates, (lon, lat) => {
      found = true
      if (lat > north) north = lat
      if (lat < south) south = lat
      if (lon > east) east = lon
      if (lon < west) west = lon
    })
  }

  if (!found) return null
  return [[south, west], [north, east]]
}
