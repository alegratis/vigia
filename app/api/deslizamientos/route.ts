import { NextResponse } from "next/server"
import { getExposureByLevel, getPopulationByLevel } from "@/lib/deslizamientos/client"
import type {
  DeslizamientosErrorResponse,
  DeslizamientosResponse,
} from "@/lib/deslizamientos/api-types"

export async function GET() {
  try {
    const [populationByLevel, exposureByLevel] = await Promise.all([
      getPopulationByLevel(),
      getExposureByLevel(),
    ])
    const body: DeslizamientosResponse = {
      generatedAt: new Date().toISOString(),
      populationByLevel,
      exposureByLevel,
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
