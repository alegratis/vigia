import { NextResponse } from "next/server"
import { getPrecipitacionAmenaza } from "@/lib/precipitacion/server"
import type {
  PrecipitacionAmenazaErrorResponse,
  PrecipitacionAmenazaResponse,
} from "@/lib/precipitacion/api-types"

// Fans out one NASA POWER request per unique vereda centroid (~55 veredas,
// concurrency-capped in lib/precipitacion/power-client.ts) — give it more
// room than the default 10s/15s route budget, same reasoning as /api/veredas.
export const maxDuration = 60

export async function GET() {
  try {
    const { windowEnd, veredas } = await getPrecipitacionAmenaza()
    const body: PrecipitacionAmenazaResponse = {
      generatedAt: new Date().toISOString(),
      windowEnd,
      veredas,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: PrecipitacionAmenazaErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar la capa de precipitación.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
