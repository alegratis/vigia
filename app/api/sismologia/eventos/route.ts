import { NextResponse } from "next/server"
import { getSismologiaEventos } from "@/lib/sismologia/server"
import type { SismologiaEventosErrorResponse } from "@/lib/sismologia/api-types"

export async function GET() {
  try {
    const body = await getSismologiaEventos()
    return NextResponse.json(body)
  } catch (err) {
    const body: SismologiaEventosErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la actividad sísmica.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
