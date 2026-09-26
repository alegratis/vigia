import { NextResponse } from "next/server"
import { getPobrezaMultidimensional, getViviendasHogaresPersonas } from "@/lib/demografia/dane-geoportal"
import type {
  DemografiaGeoportalResponse,
  DemografiaGeoportalErrorResponse,
} from "@/lib/demografia/geoportal-api-types"

const SOURCE = "DANE — Geoportal (IPM 2018 y Censo Nacional de Población y Vivienda 2018)"
const SOURCE_URL = "https://geoportal.dane.gov.co/"

export async function GET() {
  try {
    const [pobreza, manzanas] = await Promise.all([getPobrezaMultidimensional(), getViviendasHogaresPersonas()])
    const body: DemografiaGeoportalResponse = {
      generatedAt: new Date().toISOString(),
      pobreza,
      manzanas,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: DemografiaGeoportalErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar el geoportal de DANE.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
