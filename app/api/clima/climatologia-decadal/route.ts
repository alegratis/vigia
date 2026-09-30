import { NextResponse } from "next/server"
import { getMunicipioCentroids, getVeredaCentroidByCode } from "@/lib/clima/server"
import { MONTH_LABELS_ES } from "@/lib/clima/api-types"
import {
  averageYearMonthlyTempSeries,
  getCurrentYearMonthlyTemperature,
  getCurrentYearMonthlyTemperatureBatch,
  getRecentPastYears,
  getYearMonthlyTemperature,
  getYearMonthlyTemperatureBatch,
  type CurrentYearMonthlyTempPoint,
} from "@/lib/clima/openmeteo-historical-client"
import {
  getDecadaBins,
  getDecadaMonthlyTempClimatology,
  getDecadaMonthlyTempClimatologyBatch,
  type DecadaTempSeries,
} from "@/lib/clima/openmeteo-decadal-climatology"
import type {
  ClimaClimatologiaDecadalErrorResponse,
  ClimaClimatologiaDecadalResponse,
  TempDecadaMesPunto,
} from "@/lib/clima/api-types"

/** Averages a batch of per-vereda 10-year-bin series into one, skipping any vereda that failed to resolve. */
function averageDecadas(batch: Array<DecadaTempSeries[] | null>): DecadaTempSeries[] {
  const valid = batch.filter((series): series is DecadaTempSeries[] => series != null)
  if (valid.length === 0) return []
  // Every vereda's series was built from the same getDecadaBins call, so the bin boundaries line up positionally.
  return valid[0].map((bin, bi) => ({
    inicio: bin.inicio,
    fin: bin.fin,
    meses: Array.from({ length: 12 }, (_, i) => {
      const values = valid.map((s) => s[bi]?.meses[i]?.tempC).filter((v): v is number => v != null)
      return {
        month: i + 1,
        tempC: values.length > 0 ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : null,
      }
    }),
  }))
}

function mergeMeses(
  decadas: DecadaTempSeries[],
  currentYear: CurrentYearMonthlyTempPoint[],
  aniosRecientes: number[],
  recentSeries: CurrentYearMonthlyTempPoint[][],
): TempDecadaMesPunto[] {
  return MONTH_LABELS_ES.map((monthLabel, i) => ({
    month: i + 1,
    monthLabel,
    decadas: decadas.map((d) => ({ inicio: d.inicio, fin: d.fin, tempC: d.meses[i]?.tempC ?? null })),
    tempActual: currentYear[i]?.tempC ?? null,
    sensacionActual: currentYear[i]?.sensacionC ?? null,
    esMesEnCurso: currentYear[i]?.isPartial ?? false,
    reciente: aniosRecientes.map((anio, yi) => ({ anio, tempC: recentSeries[yi]?.[i]?.tempC ?? null })),
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const codigoVereda = searchParams.get("codigoVereda")
  const municipio = searchParams.get("municipio")

  if (!codigoVereda && !municipio) {
    const body: ClimaClimatologiaDecadalErrorResponse = { error: "Falta el parámetro codigoVereda o municipio." }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const now = new Date()
    const aniosRecientes = getRecentPastYears(2, now)
    const decadas = getDecadaBins(now)
    let body: ClimaClimatologiaDecadalResponse

    if (municipio) {
      const match = await getMunicipioCentroids(municipio)
      if (!match) {
        const errorBody: ClimaClimatologiaDecadalErrorResponse = { error: "Municipio no encontrado." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [decadaBatch, currentYearBatch, recentBatches] = await Promise.all([
        getDecadaMonthlyTempClimatologyBatch(match.centroids, now),
        getCurrentYearMonthlyTemperatureBatch(match.centroids),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyTemperatureBatch(match.centroids, anio))),
      ])
      body = {
        scope: "municipio",
        ubicacion: { nombre: match.nombre, municipio: match.nombre, veredasPromediadas: match.centroids.length },
        generatedAt: now.toISOString(),
        mesEnCurso: now.getUTCMonth() + 1,
        decadas,
        aniosRecientes,
        meses: mergeMeses(
          averageDecadas(decadaBatch),
          averageYearMonthlyTempSeries(currentYearBatch),
          aniosRecientes,
          recentBatches.map((batch) => averageYearMonthlyTempSeries(batch)),
        ),
      }
    } else {
      const vereda = await getVeredaCentroidByCode(codigoVereda!)
      if (!vereda) {
        const errorBody: ClimaClimatologiaDecadalErrorResponse = { error: "Vereda no encontrada." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [decadaSeries, currentYear, recentSeries] = await Promise.all([
        getDecadaMonthlyTempClimatology(vereda.lon, vereda.lat, now),
        getCurrentYearMonthlyTemperature(vereda.lon, vereda.lat),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyTemperature(vereda.lon, vereda.lat, anio))),
      ])
      body = {
        scope: "vereda",
        ubicacion: { nombre: vereda.nombre, municipio: vereda.municipio, codigoVereda: codigoVereda! },
        generatedAt: now.toISOString(),
        mesEnCurso: now.getUTCMonth() + 1,
        decadas,
        aniosRecientes,
        meses: mergeMeses(decadaSeries, currentYear, aniosRecientes, recentSeries),
      }
    }

    return NextResponse.json(body)
  } catch (err) {
    const body: ClimaClimatologiaDecadalErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la climatología decadal de temperatura.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
