import { NextResponse } from "next/server"
import { getVeredaList } from "@/lib/veredas/list"
import { parseMunicipioCodes } from "@/lib/veredas/parse-municipio-param"
import type { VeredaListErrorResponse, VeredaListResponse } from "@/lib/veredas/list-api-types"

// Boundary fetch is cached a week (see lib/veredas/boundaries.ts), but a
// cold cache still means two upstream ArcGIS queries.
export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const municipioCodes = parseMunicipioCodes(new URL(request.url).searchParams.get("municipio"))
    const veredas = await getVeredaList(municipioCodes)
    const body: VeredaListResponse = {
      generatedAt: new Date().toISOString(),
      veredas,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: VeredaListErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar las veredas.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
