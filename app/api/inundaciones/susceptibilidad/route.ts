import { NextResponse } from "next/server"
import { getFloodSusceptibilityPolygons } from "@/lib/inundaciones/client"
import type {
  InundacionesSusceptibilidadErrorResponse,
  InundacionesSusceptibilidadResponse,
} from "@/lib/inundaciones/api-types"

export async function GET() {
  try {
    const polygons = await getFloodSusceptibilityPolygons()
    const body: InundacionesSusceptibilidadResponse = {
      generatedAt: new Date().toISOString(),
      polygons,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: InundacionesSusceptibilidadErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar la capa de susceptibilidad a inundaciones.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
