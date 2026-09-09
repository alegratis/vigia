import { NextResponse } from "next/server"
import { getVeredaCentroidByCode } from "@/lib/precipitacion/server"
import { getMonthlyClimatology } from "@/lib/precipitacion/ideam-climatology"
import type { ClimatologiaErrorResponse, ClimatologiaResponse } from "@/lib/precipitacion/api-types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const codigoVereda = searchParams.get("codigoVereda")

  if (!codigoVereda) {
    const body: ClimatologiaErrorResponse = { error: "Falta el parámetro codigoVereda." }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const vereda = await getVeredaCentroidByCode(codigoVereda)
    if (!vereda) {
      const body: ClimatologiaErrorResponse = { error: "Vereda no encontrada." }
      return NextResponse.json(body, { status: 404 })
    }

    const meses = await getMonthlyClimatology(vereda.lon, vereda.lat)
    const body: ClimatologiaResponse = {
      vereda: { codigoVereda, nombre: vereda.nombre, municipio: vereda.municipio },
      generatedAt: new Date().toISOString(),
      meses,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: ClimatologiaErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la climatología de IDEAM.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
