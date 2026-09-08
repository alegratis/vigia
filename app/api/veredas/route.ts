import { NextResponse } from "next/server"
import { getVeredas } from "@/lib/veredas/server"
import type { VeredasErrorResponse, VeredasResponse } from "@/lib/veredas/api-types"

// A cold cache means decoding 35 vector tiles and point-in-polygon testing
// ~11,800 points against ~70 vereda boundaries; the default 10s (Hobby) /
// 15s route budget can be tight for that first request.
export const maxDuration = 60

export async function GET() {
  try {
    const veredas = await getVeredas()
    const body: VeredasResponse = {
      generatedAt: new Date().toISOString(),
      veredas,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: VeredasErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar los límites veredales.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
