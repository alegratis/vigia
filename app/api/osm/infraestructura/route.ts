import { NextResponse } from "next/server"
import { getInfrastructurePoints } from "@/lib/osm/overpass"
import { resolveRegion } from "@/lib/lugares/region"
import { overpassBbox } from "@/lib/lugares/geo-bbox"
import type { OsmInfrastructureErrorResponse, OsmInfrastructureResponse } from "@/lib/osm/api-types"

// Headroom above the ~7s Overpass mirror race (see lib/osm/overpass.ts) for
// plans that support a higher function duration than the default. Capped
// automatically to whatever the current plan allows.
export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // `?municipio=<code>` scopes the Overpass query to that municipio's bbox;
  // absent, it defaults to Sevilla (the app's home municipio).
  const region = resolveRegion(searchParams.get("municipio"))

  try {
    const points = await getInfrastructurePoints(overpassBbox(region.bounds))
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
