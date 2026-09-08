import { NextResponse } from "next/server"
import { getPrecipitacionAmenaza } from "@/lib/precipitacion/server"
import {
  ACCUMULATION_WINDOW_OPTIONS,
  FORECAST_WINDOW_OPTIONS,
  type PrecipitacionAmenazaErrorResponse,
  type PrecipitacionAmenazaResponse,
  type PrecipitacionMode,
} from "@/lib/precipitacion/api-types"

// Fans out one NASA POWER or Open-Meteo request per unique vereda centroid
// (~55 veredas, concurrency-capped in lib/precipitacion/power-client.ts and
// lib/precipitacion/forecast-client.ts) — give it more room than the
// default 10s/15s route budget, same reasoning as /api/veredas.
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const modeParam = searchParams.get("mode")
  const mode: PrecipitacionMode = modeParam === "pronostico" ? "pronostico" : "historico"

  const windowOptions: readonly number[] = mode === "pronostico" ? FORECAST_WINDOW_OPTIONS : ACCUMULATION_WINDOW_OPTIONS
  const windowParam = Number(searchParams.get("window"))
  const windowDays = windowOptions.includes(windowParam) ? windowParam : 7

  try {
    const { windowEnd, veredas } = await getPrecipitacionAmenaza({ mode, windowDays })
    const body: PrecipitacionAmenazaResponse = {
      generatedAt: new Date().toISOString(),
      mode,
      windowDays,
      windowEnd,
      veredas,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: PrecipitacionAmenazaErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar la capa de precipitación.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
