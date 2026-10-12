import { NextResponse } from "next/server"
import { getAoiReaches } from "@/lib/geoglows/reaches"
import type { GeoglowsReachesErrorResponse, GeoglowsReachesResponse } from "@/lib/geoglows/reaches-types"

export const revalidate = 3600

/** Live GEOGLOWS river reaches (with names where known) for the inundaciones map. */
export async function GET() {
  try {
    const body: GeoglowsReachesResponse = {
      generatedAt: new Date().toISOString(),
      reaches: await getAoiReaches(),
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: GeoglowsReachesErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar los ríos de GEOGLOWS.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
