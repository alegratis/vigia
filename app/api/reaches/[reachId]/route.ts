import { NextResponse } from "next/server"
import { assessReach, GeoglowsError } from "@/lib/geoglows/service"

/**
 * Flood assessment for a specific GEOGLOWS reach id.
 * GET /api/reaches/610457350
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reachId: string }> },
) {
  const { reachId: raw } = await params
  const reachId = Number(raw)

  if (!Number.isInteger(reachId) || reachId <= 0) {
    return NextResponse.json(
      { error: "reachId debe ser un entero positivo" },
      { status: 400 },
    )
  }

  try {
    const assessment = await assessReach(reachId)
    return NextResponse.json(assessment)
  } catch (err) {
    if (err instanceof GeoglowsError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status && err.status >= 400 && err.status < 500 ? 404 : 502 },
      )
    }
    if (err instanceof Error && err.message.includes("Insufficient history")) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    return NextResponse.json(
      { error: "Error interno al evaluar el tramo" },
      { status: 500 },
    )
  }
}
