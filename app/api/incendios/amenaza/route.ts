import { NextResponse } from "next/server"
import { getFireThreatPolygons } from "@/lib/incendios/client"
import type {
  IncendiosAmenazaErrorResponse,
  IncendiosAmenazaResponse,
} from "@/lib/incendios/api-types"

export async function GET() {
  try {
    const polygons = await getFireThreatPolygons()
    const body: IncendiosAmenazaResponse = {
      generatedAt: new Date().toISOString(),
      polygons,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: IncendiosAmenazaErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar la capa de amenaza por incendios.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
