import { NextResponse } from "next/server"
import { getMunicipioCentroids, getVeredaCentroidByCode } from "@/lib/precipitacion/server"
import { MONTH_LABELS_ES } from "@/lib/precipitacion/ideam-climatology"
import {
  averageYearMonthlySeries,
  getCurrentYearMonthlyPrecipitation,
  getCurrentYearMonthlyPrecipitationBatch,
  getRecentPastYears,
  getYearMonthlyPrecipitation,
  getYearMonthlyPrecipitationBatch,
  type CurrentYearMonthlyPoint,
} from "@/lib/precipitacion/openmeteo-historical-client"
import {
  getQuinquenioBins,
  getQuinquenioMonthlyClimatology,
  getQuinquenioMonthlyClimatologyBatch,
  type QuinquenioSeries,
} from "@/lib/precipitacion/openmeteo-quinquenal-climatology"
import type {
  ClimatologiaQuinquenalErrorResponse,
  ClimatologiaQuinquenalResponse,
  QuinquenioMesPunto,
} from "@/lib/precipitacion/api-types"

/** Averages a batch of per-vereda 5-year-bin series into one, skipping any vereda that failed to resolve. */
function averageQuinquenios(batch: Array<QuinquenioSeries[] | null>): QuinquenioSeries[] {
  const valid = batch.filter((series): series is QuinquenioSeries[] => series != null)
  if (valid.length === 0) return []
  // Every vereda's series was built from the same getQuinquenioBins call, so the bin boundaries line up positionally.
  return valid[0].map((bin, bi) => ({
    inicio: bin.inicio,
    fin: bin.fin,
    meses: Array.from({ length: 12 }, (_, i) => {
      const values = valid.map((s) => s[bi]?.meses[i]?.mm).filter((v): v is number => v != null)
      return {
        month: i + 1,
        mm: values.length > 0 ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : null,
      }
    }),
  }))
}

function mergeMeses(
  quinquenios: QuinquenioSeries[],
  currentYear: CurrentYearMonthlyPoint[],
  aniosRecientes: number[],
  recentSeries: CurrentYearMonthlyPoint[][],
): QuinquenioMesPunto[] {
  return MONTH_LABELS_ES.map((monthLabel, i) => ({
    month: i + 1,
    monthLabel,
    quinquenios: quinquenios.map((q) => ({ inicio: q.inicio, fin: q.fin, mm: q.meses[i]?.mm ?? null })),
    mmActual: currentYear[i]?.mm ?? null,
    esMesEnCurso: currentYear[i]?.isPartial ?? false,
    reciente: aniosRecientes.map((anio, yi) => ({ anio, mm: recentSeries[yi]?.[i]?.mm ?? null })),
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const codigoVereda = searchParams.get("codigoVereda")
  const municipio = searchParams.get("municipio")

  if (!codigoVereda && !municipio) {
    const body: ClimatologiaQuinquenalErrorResponse = { error: "Falta el parámetro codigoVereda o municipio." }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const now = new Date()
    // The two calendar years right before this one, shown individually rather than folded into a bin —
    // see getQuinquenioBins for why the bins stop 3 years short of the current year.
    const aniosRecientes = getRecentPastYears(2, now)
    const quinquenios = getQuinquenioBins(now)
    let body: ClimatologiaQuinquenalResponse

    if (municipio) {
      const match = await getMunicipioCentroids(municipio)
      if (!match) {
        const errorBody: ClimatologiaQuinquenalErrorResponse = { error: "Municipio no encontrado." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [quinquenioBatch, currentYearBatch, recentBatches] = await Promise.all([
        getQuinquenioMonthlyClimatologyBatch(match.centroids, now),
        getCurrentYearMonthlyPrecipitationBatch(match.centroids),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyPrecipitationBatch(match.centroids, anio))),
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
          averageYearMonthlySeries(currentYearBatch),
          aniosRecientes,
          recentBatches.map((batch) => averageYearMonthlySeries(batch)),
        ),
      }
    } else {
      const vereda = await getVeredaCentroidByCode(codigoVereda!)
      if (!vereda) {
        const errorBody: ClimatologiaQuinquenalErrorResponse = { error: "Vereda no encontrada." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [quinquenioSeries, currentYear, recentSeries] = await Promise.all([
        getQuinquenioMonthlyClimatology(vereda.lon, vereda.lat, now),
        getCurrentYearMonthlyPrecipitation(vereda.lon, vereda.lat),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyPrecipitation(vereda.lon, vereda.lat, anio))),
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
    const body: ClimatologiaQuinquenalErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la climatología quinquenal de Open-Meteo.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
