import { NextResponse } from "next/server"
import { getVeredas } from "@/lib/veredas/server"
import type { VeredasErrorResponse, VeredasResponse } from "@/lib/veredas/api-types"

// A cold cache means decoding boundaries, point-in-polygon testing ~11,800
// RED LabOT points against ~70 vereda boundaries, *and* computing this
// app's own hazard model per vereda centroid (elevation samples, an
// AOI-wide road query, and a rainfall-history lookup per point — see
// lib/deslizamientos/hazard-model.ts); the default 10s (Hobby) / 15s route
// budget can be tight for that first request. Each hazard input caches
// independently (elevation 30 days, roads 6 hours, rainfall 1 hour), so
// only the very first request per cache window pays the full cost.
export const maxDuration = 60

export async function GET() {
  try {
    const veredas = await getVeredas()
    const body: VeredasResponse = {
      generatedAt: new Date().toISOString(),
      veredas,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: VeredasErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar los límites veredales.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
