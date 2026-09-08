import { NextResponse } from "next/server"
import { getVeredaList } from "@/lib/veredas/list"
import type { VeredaListErrorResponse, VeredaListResponse } from "@/lib/veredas/list-api-types"

// Boundary decode is cached a week (see lib/veredas/tiles.ts), but a cold
// cache still means fetching and parsing 35 vector tiles.
export const maxDuration = 30

export async function GET() {
  try {
    const veredas = await getVeredaList()
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
