import { NextResponse } from "next/server"
import {
  getAreaFires,
  FirmsConfigError,
  FirmsRequestError,
} from "@/lib/firms/client"
import { summarize } from "@/lib/firms/summary"
import { STUDY_AREA, DEPARTMENT } from "@/lib/firms/area"
import type { FiresResponse, FiresErrorResponse } from "@/lib/firms/api-types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dayParam = Number.parseInt(searchParams.get("days") ?? "2", 10)
  const dayRange = Number.isFinite(dayParam) ? dayParam : 2

  try {
    const result = await getAreaFires(dayRange)
    const body: FiresResponse = {
      area: { ...STUDY_AREA },
      department: DEPARTMENT,
      dayRange: result.dayRange,
      detections: result.detections,
      summary: summarize(result.detections),
      sourcesQueried: result.sourcesQueried,
      sourcesFailed: result.sourcesFailed,
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof FirmsConfigError) {
      const body: FiresErrorResponse = {
        error:
          "Falta configurar la clave FIRMS_MAP_KEY. Obtén una gratis en firms.modaps.eosdis.nasa.gov/api/map_key y agrégala en las variables del proyecto.",
        needsConfig: true,
      }
      return NextResponse.json(body, { status: 503 })
    }
    if (err instanceof FirmsRequestError) {
      const body: FiresErrorResponse = { error: err.message }
      return NextResponse.json(body, { status: 502 })
    }
    const body: FiresErrorResponse = { error: "Error inesperado al consultar NASA FIRMS." }
    return NextResponse.json(body, { status: 500 })
  }
}
