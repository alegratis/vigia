import { NextResponse } from "next/server"
import { getFaultTraces } from "@/lib/deslizamientos/faults"
import { resolveRegion } from "@/lib/lugares/region"
import { arcgisEnvelope } from "@/lib/lugares/geo-bbox"
import type { FaultsErrorResponse, FaultsResponse } from "@/lib/deslizamientos/fault-types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = resolveRegion(searchParams.get("municipio"))

  try {
    const traces = await getFaultTraces(arcgisEnvelope(region.bounds))
    const body: FaultsResponse = {
      generatedAt: new Date().toISOString(),
      traces,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: FaultsErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar las fallas geológicas.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
