import { NextResponse } from "next/server"
import { getPobrezaMultidimensional, getViviendasHogaresPersonas } from "@/lib/demografia/dane-geoportal"
import type {
  DemografiaGeoportalResponse,
  DemografiaGeoportalErrorResponse,
} from "@/lib/demografia/geoportal-api-types"

const SOURCE = "DANE, Censo Nacional de Población y Vivienda 2018 (IPM y vulnerabilidad por manzana)"
const SOURCE_URL = "https://www.dane.gov.co/files/geoportal-provisional/index.html"

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
