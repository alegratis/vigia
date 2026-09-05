import { NextResponse } from "next/server"
import { getPopulationByLevel, getSusceptibilityPolygons } from "@/lib/deslizamientos/client"
import type {
  DeslizamientosErrorResponse,
  DeslizamientosResponse,
} from "@/lib/deslizamientos/api-types"

export async function GET() {
  try {
    const [polygons, populationByLevel] = await Promise.all([
      getSusceptibilityPolygons(),
      getPopulationByLevel(),
    ])
    const body: DeslizamientosResponse = {
      generatedAt: new Date().toISOString(),
      polygons,
      populationByLevel,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: DeslizamientosErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar la capa de deslizamientos.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
