import { NextResponse } from "next/server"
import { getRiesgoCompuestoVeredas } from "@/lib/riesgo-compuesto/server"
import type { RiesgoCompuestoErrorResponse, RiesgoCompuestoResponse } from "@/lib/riesgo-compuesto/api-types"

// Composes /api/veredas' own aggregation (boundaries + deslizamientos + inundaciones + demographics),
// a fire-threat centroid join, and a precipitación accumulation batch — a cold cache pays the sum of
// all three's own first-request costs. Each still caches independently, so only the first request per
// cache window pays the full price.
export const maxDuration = 60

export async function GET() {
  try {
    const veredas = await getRiesgoCompuestoVeredas()
    const body: RiesgoCompuestoResponse = {
      generatedAt: new Date().toISOString(),
      veredas,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: RiesgoCompuestoErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al calcular el riesgo compuesto.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
