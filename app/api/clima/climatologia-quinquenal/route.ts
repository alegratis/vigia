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
  getQuinquenioBins,
  getQuinquenioMonthlyTempClimatology,
  getQuinquenioMonthlyTempClimatologyBatch,
  type QuinquenioTempSeries,
} from "@/lib/clima/openmeteo-quinquenal-climatology"
import type {
  ClimaClimatologiaQuinquenalErrorResponse,
  ClimaClimatologiaQuinquenalResponse,
  TempQuinquenioMesPunto,
} from "@/lib/clima/api-types"

/** Averages a batch of per-vereda 5-year-bin series into one, skipping any vereda that failed to resolve. */
function averageQuinquenios(batch: Array<QuinquenioTempSeries[] | null>): QuinquenioTempSeries[] {
  const valid = batch.filter((series): series is QuinquenioTempSeries[] => series != null)
  if (valid.length === 0) return []
  // Every vereda's series was built from the same getQuinquenioBins call, so the bin boundaries line up positionally.
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
  quinquenios: QuinquenioTempSeries[],
  currentYear: CurrentYearMonthlyTempPoint[],
  aniosRecientes: number[],
  recentSeries: CurrentYearMonthlyTempPoint[][],
): TempQuinquenioMesPunto[] {
  return MONTH_LABELS_ES.map((monthLabel, i) => ({
    month: i + 1,
    monthLabel,
    quinquenios: quinquenios.map((q) => ({ inicio: q.inicio, fin: q.fin, tempC: q.meses[i]?.tempC ?? null })),
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
    const body: ClimaClimatologiaQuinquenalErrorResponse = { error: "Falta el parámetro codigoVereda o municipio." }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const now = new Date()
    const aniosRecientes = getRecentPastYears(2, now)
    const quinquenios = getQuinquenioBins(now)
    let body: ClimaClimatologiaQuinquenalResponse

    if (municipio) {
      const match = await getMunicipioCentroids(municipio)
      if (!match) {
        const errorBody: ClimaClimatologiaQuinquenalErrorResponse = { error: "Municipio no encontrado." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [quinquenioBatch, currentYearBatch, recentBatches] = await Promise.all([
        getQuinquenioMonthlyTempClimatologyBatch(match.centroids, now),
        getCurrentYearMonthlyTemperatureBatch(match.centroids),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyTemperatureBatch(match.centroids, anio))),
      ])
      body = {
        scope: "municipio",
        ubicacion: { nombre: match.nombre, municipio: match.nombre, veredasPromediadas: match.centroids.length },
        generatedAt: now.toISOString(),
        mesEnCurso: now.getUTCMonth() + 1,
        quinquenios,
        aniosRecientes,
        meses: mergeMeses(
          averageQuinquenios(quinquenioBatch),
          averageYearMonthlyTempSeries(currentYearBatch),
          aniosRecientes,
          recentBatches.map((batch) => averageYearMonthlyTempSeries(batch)),
        ),
      }
    } else {
      const vereda = await getVeredaCentroidByCode(codigoVereda!)
      if (!vereda) {
        const errorBody: ClimaClimatologiaQuinquenalErrorResponse = { error: "Vereda no encontrada." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [quinquenioSeries, currentYear, recentSeries] = await Promise.all([
        getQuinquenioMonthlyTempClimatology(vereda.lon, vereda.lat, now),
        getCurrentYearMonthlyTemperature(vereda.lon, vereda.lat),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyTemperature(vereda.lon, vereda.lat, anio))),
      ])
      body = {
        scope: "vereda",
        ubicacion: { nombre: vereda.nombre, municipio: vereda.municipio, codigoVereda: codigoVereda! },
        generatedAt: now.toISOString(),
        mesEnCurso: now.getUTCMonth() + 1,
        quinquenios,
        aniosRecientes,
        meses: mergeMeses(quinquenioSeries, currentYear, aniosRecientes, recentSeries),
      }
    }

    return NextResponse.json(body)
  } catch (err) {
    const body: ClimaClimatologiaQuinquenalErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la climatología quinquenal de temperatura.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
