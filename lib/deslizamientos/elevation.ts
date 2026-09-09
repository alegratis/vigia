import "server-only"

/**
 * Slope — the terrain-susceptibility half of the self-computed landslide
 * hazard model (see hazard-model.ts) — estimated from Copernicus GLO-30 DEM
 * elevation via Open-Meteo's free elevation API (no key, CORS-enabled,
 * same "no setup" open-data pattern as the rest of this app). Slope is the
 * single largest static predictor in NASA's LHASA v1 global susceptibility
 * map (Stanley & Kirschbaum, 2017); ESA WorldCover / geology layers were
 * considered too (see the module doc in hazard-model.ts) but only exist as
 * raw satellite raster files with no point-query API, so they aren't
 * feasible from a serverless function.
 *
 * Open-Meteo's elevation endpoint returns a single elevation per
 * coordinate, not a gradient — slope here is a finite-difference estimate:
 * each centroid is sampled alongside its four cardinal neighbors ~500 m
 * out, and the steeper of the north-south / east-west gradients is kept.
 *
 * Docs: https://open-meteo.com/en/docs/elevation-api
 */

const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

// Open-Meteo doesn't document a hard cap for this endpoint, but other
// Open-Meteo endpoints cap batched requests around 100 locations — chunk
// well under that so one oversized request can't take down the whole batch.
const CHUNK_SIZE = 90

// Terrain elevation never changes; cache generously.
const REVALIDATE_SECONDS = 2_592_000 // 30 days

/** Finite-difference step, in degrees of latitude (~500 m). */
const OFFSET_DEG = 0.0045
const METERS_PER_DEGREE_LAT = 111_320
/** Physical distance the offset above resolves to, by construction (~501 m). */
const OFFSET_METERS = OFFSET_DEG * METERS_PER_DEGREE_LAT

/** Degree offset in longitude that covers the same physical distance as OFFSET_DEG does in latitude, at a given latitude. */
function lonOffsetDeg(latDeg: number): number {
  return OFFSET_DEG / Math.cos((latDeg * Math.PI) / 180)
}

async function fetchElevations(points: Array<{ lat: number; lon: number }>): Promise<Array<number | null>> {
  const out: Array<number | null> = new Array(points.length).fill(null)

  for (let i = 0; i < points.length; i += CHUNK_SIZE) {
    const chunk = points.slice(i, i + CHUNK_SIZE)
    const params = new URLSearchParams({
      latitude: chunk.map((p) => p.lat.toFixed(5)).join(","),
      longitude: chunk.map((p) => p.lon.toFixed(5)).join(","),
    })
    const res = await fetch(`${ELEVATION_URL}?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) throw new Error(`Open-Meteo elevation query failed (${res.status})`)
    const data = await res.json()
    const elevations = (data?.elevation ?? []) as number[]
    for (let j = 0; j < chunk.length; j++) {
      out[i + j] = typeof elevations[j] === "number" ? elevations[j] : null
    }
  }

  return out
}

export interface SlopeCentroid {
  lat: number
  lon: number
}

/**
 * Estimates ground slope, in degrees, at each input centroid — same order
 * as the input array. `null` for a centroid whose sample chunk failed,
 * rather than throwing, so a partial elevation-API outage degrades that
 * subset of veredas gracefully instead of blanking the whole hazard map
 * (see hazard-model.ts's per-factor renormalization).
 */
export async function getSlopeForCentroids(centroids: SlopeCentroid[]): Promise<Array<number | null>> {
  if (centroids.length === 0) return []

  // Center sample is unused for the gradient itself but keeps the chunking
  // math simple (5 fixed slots per centroid) and is cheap to keep around.
  const samplePoints: Array<{ lat: number; lon: number }> = []
  for (const c of centroids) {
    const lonOffset = lonOffsetDeg(c.lat)
    samplePoints.push(
      { lat: c.lat, lon: c.lon },
      { lat: c.lat + OFFSET_DEG, lon: c.lon },
      { lat: c.lat - OFFSET_DEG, lon: c.lon },
      { lat: c.lat, lon: c.lon + lonOffset },
      { lat: c.lat, lon: c.lon - lonOffset },
    )
  }

  const elevations = await fetchElevations(samplePoints)

  return centroids.map((_, i) => {
    const [, north, south, east, west] = elevations.slice(i * 5, i * 5 + 5)
    if (north == null || south == null || east == null || west == null) return null

    const distanceM = 2 * OFFSET_METERS
    const nsSlopeRad = Math.atan(Math.abs(north - south) / distanceM)
    const ewSlopeRad = Math.atan(Math.abs(east - west) / distanceM)
    return (Math.max(nsSlopeRad, ewSlopeRad) * 180) / Math.PI
  })
}
