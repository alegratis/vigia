import { NextResponse } from "next/server"
import { getInfrastructurePoints } from "@/lib/osm/overpass"
import type { OsmInfrastructureErrorResponse, OsmInfrastructureResponse } from "@/lib/osm/api-types"

export async function GET() {
  try {
    const points = await getInfrastructurePoints()
    const body: OsmInfrastructureResponse = {
      generatedAt: new Date().toISOString(),
      points,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: OsmInfrastructureErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar la infraestructura de OpenStreetMap.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
