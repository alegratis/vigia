import { NextResponse } from "next/server"
import { getCriticalSites } from "@/lib/deslizamientos/critical-sites"
import type { CriticalSitesErrorResponse, CriticalSitesResponse } from "@/lib/deslizamientos/critical-sites-types"

export async function GET() {
  try {
    const points = await getCriticalSites()
    const body: CriticalSitesResponse = {
      generatedAt: new Date().toISOString(),
      surveyDate: points[0]?.fecha ?? null,
      points,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: CriticalSitesErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar los sitios críticos.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
