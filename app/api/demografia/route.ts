import { NextResponse } from "next/server"
import { getExposureOverview } from "@/lib/demografia/exposure"
import { DEPARTMENT } from "@/lib/geoglows/stations"
import type {
  DemografiaResponse,
  DemografiaErrorResponse,
} from "@/lib/demografia/api-types"

export async function GET() {
  try {
    const result = await getExposureOverview()
    const body: DemografiaResponse = {
      department: DEPARTMENT,
      generatedAt: new Date().toISOString(),
      ...result,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: DemografiaErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al calcular la exposición demográfica.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
