import { NextResponse } from "next/server"
import { getClimaForecast } from "@/lib/clima/server"
import type {
  ClimaForecastErrorResponse,
  ClimaForecastResponse,
} from "@/lib/clima/api-types"

// Fans out one Open-Meteo request per unique vereda centroid (~55 veredas,
// concurrency-capped in lib/clima/weather-client.ts) plus one incendios-layer
// fetch — give it more room than the default route budget, same reasoning as
// /api/precipitacion/amenaza.
export const maxDuration = 60

export async function GET() {
  try {
    const { forecastDays, municipios, veredas } = await getClimaForecast()
    const body: ClimaForecastResponse = {
      generatedAt: new Date().toISOString(),
      forecastDays,
      municipios,
      veredas,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: ClimaForecastErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar la capa de clima.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
