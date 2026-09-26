import { NextRequest, NextResponse } from "next/server"
import { getFaultTraces } from "@/lib/deslizamientos/faults"
import type { FaultsErrorResponse, FaultsResponse } from "@/lib/deslizamientos/fault-types"

// Colombia's own rough bounding box — clamps a client-supplied `bbox` (the
// live map's current viewport, re-queried dynamically as the user pans or
// zooms; see use-faults.ts) so an unexpected value can't turn into an
// oversized query against the third-party SGC ArcGIS service.
const COLOMBIA_BOUNDS = { minLon: -79.1, minLat: -4.3, maxLon: -66.8, maxLat: 13.6 }

function parseBbox(raw: string | null): string | undefined {
  if (!raw) return undefined
  const parts = raw.split(",").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined
  const minLon = Math.max(Math.min(parts[0], parts[2]), COLOMBIA_BOUNDS.minLon)
  const minLat = Math.max(Math.min(parts[1], parts[3]), COLOMBIA_BOUNDS.minLat)
  const maxLon = Math.min(Math.max(parts[0], parts[2]), COLOMBIA_BOUNDS.maxLon)
  const maxLat = Math.min(Math.max(parts[1], parts[3]), COLOMBIA_BOUNDS.maxLat)
  if (minLon >= maxLon || minLat >= maxLat) return undefined
  return `${minLon},${minLat},${maxLon},${maxLat}`
}

export async function GET(request: NextRequest) {
  try {
    const bbox = parseBbox(new URL(request.url).searchParams.get("bbox"))
    const traces = await getFaultTraces(bbox)
    const body: FaultsResponse = {
      generatedAt: new Date().toISOString(),
      traces,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: FaultsErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar las fallas geológicas.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
