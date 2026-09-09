import { NextResponse } from "next/server"
import { getFaultTraces } from "@/lib/deslizamientos/faults"
import type { FaultsErrorResponse, FaultsResponse } from "@/lib/deslizamientos/fault-types"

export async function GET() {
  try {
    const traces = await getFaultTraces()
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
