import { NextResponse } from "next/server"
import { getSismologiaDanos } from "@/lib/sismologia/survey-damage"
import type { SismologiaDanosErrorResponse } from "@/lib/sismologia/api-types"

export async function GET() {
  try {
    const body = await getSismologiaDanos()
    return NextResponse.json(body)
  } catch (err) {
    const body: SismologiaDanosErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar los reportes de daños.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
