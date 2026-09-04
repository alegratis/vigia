import { NextResponse } from "next/server"
import { assessCoordinate, GeoglowsError } from "@/lib/geoglows/service"

/**
 * Flood assessment by coordinate. Resolves the nearest reach, then assesses it.
 * GET /api/assess?lat=4.405&lon=-76.075
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = Number(searchParams.get("lat"))
  const lon = Number(searchParams.get("lon"))

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "lat inválida (-90 a 90)" }, { status: 400 })
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "lon inválida (-180 a 180)" }, { status: 400 })
  }

  try {
    const assessment = await assessCoordinate(lat, lon)
    return NextResponse.json(assessment)
  } catch (err) {
    if (err instanceof GeoglowsError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    if (err instanceof Error && err.message.includes("Insufficient history")) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    return NextResponse.json(
      { error: "Error interno al evaluar la coordenada" },
      { status: 500 },
    )
  }
}
