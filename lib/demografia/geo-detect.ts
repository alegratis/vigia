/**
 * IP-geolocation-based default view for the Demografía map: visitors whose
 * (coarse, city-level) IP location falls inside one of the three "other"
 * study-area municipios land on that municipio by default; everyone else —
 * undetected, outside the study area, or inside Sevilla itself — lands on
 * Sevilla's casco urbano, the category's baseline view.
 *
 * Bounding boxes are plain [[west, south], [east, north]] extents (same
 * shape as `AOI_BOUNDS` in demografia-live-map.tsx), sourced once from Esri
 * Colombia's "Veredas de Colombia" layer (whole-municipio extents for the
 * other three) and the SIRD Sevilla Barrios FeatureServer (Sevilla's urban
 * core extent) — see lib/veredas/boundaries.ts and lib/barrios/boundaries.ts
 * for those same sources. IP geolocation is city-grain at best, so a
 * whole-municipio box is the right precision for detection; only Sevilla
 * gets the tighter casco-urbano box, since that's the view we default to.
 */

export type DetectableMunicipio = "Caicedonia" | "Zarzal" | "Roldanillo"

type Bounds = [[number, number], [number, number]]

const OTHER_MUNICIPIO_BOUNDS: Record<DetectableMunicipio, Bounds> = {
  Caicedonia: [
    [-75.8943, 4.2001],
    [-75.7874, 4.4143],
  ],
  Zarzal: [
    [-76.1714, 4.2439],
    [-75.8779, 4.4667],
  ],
  Roldanillo: [
    [-76.2466, 4.3681],
    [-76.0622, 4.5157],
  ],
}

/** Sevilla's urban core (casco urbano) — the category's default view for everyone else. */
export const SEVILLA_CASCO_URBANO_BOUNDS: Bounds = [
  [-75.945, 4.252],
  [-75.918, 4.287],
]

function withinBounds(lat: number, lon: number, [[west, south], [east, north]]: Bounds): boolean {
  return lon >= west && lon <= east && lat >= south && lat <= north
}

/**
 * Matches a lat/lon pair (from `x-vercel-ip-latitude`/`x-vercel-ip-longitude`
 * request headers) to Caicedonia, Zarzal or Roldanillo, or `null` if it
 * falls outside all three — including inside Sevilla, which uses its own
 * casco-urbano default rather than a detection match.
 */
export function detectOtherMunicipio(lat: number, lon: number): DetectableMunicipio | null {
  for (const [municipio, bounds] of Object.entries(OTHER_MUNICIPIO_BOUNDS) as [DetectableMunicipio, Bounds][]) {
    if (withinBounds(lat, lon, bounds)) return municipio
  }
  return null
}

/** Zoom bounds for a detected municipio's default view, matching `SEVILLA_CASCO_URBANO_BOUNDS`'s shape. */
export function boundsForDetectedMunicipio(municipio: DetectableMunicipio): Bounds {
  return OTHER_MUNICIPIO_BOUNDS[municipio]
}
