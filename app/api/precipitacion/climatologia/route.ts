import { NextResponse } from "next/server"
import { getMunicipioCentroids, getVeredaCentroidByCode } from "@/lib/precipitacion/server"
import {
  getMonthlyClimatology,
  getMonthlyClimatologyBatch,
  MONTH_LABELS_ES,
  type MonthlyClimatologyPoint,
} from "@/lib/precipitacion/ideam-climatology"
import {
  getCurrentYearMonthlyPrecipitation,
  getCurrentYearMonthlyPrecipitationBatch,
  getRecentPastYears,
  getYearMonthlyPrecipitation,
  getYearMonthlyPrecipitationBatch,
  type CurrentYearMonthlyPoint,
} from "@/lib/precipitacion/openmeteo-historical-client"
import type { ClimatologiaErrorResponse, ClimatologiaMesPunto, ClimatologiaResponse } from "@/lib/precipitacion/api-types"

/** Averages a batch of per-vereda climatology series into one, skipping any vereda that failed to resolve. */
function averageClimatology(batch: Array<MonthlyClimatologyPoint[] | null>): MonthlyClimatologyPoint[] {
  const valid = batch.filter((series): series is MonthlyClimatologyPoint[] => series != null)
  return MONTH_LABELS_ES.map((monthLabel, i) => {
    const month = i + 1
    const as = valid.map((s) => s[i]?.mm1991_2020).filter((v): v is number => v != null)
    const bs = valid.map((s) => s[i]?.mm1981_2010).filter((v): v is number => v != null)
    return {
      month,
      monthLabel,
      mm1991_2020: as.length > 0 ? Math.round(as.reduce((sum, v) => sum + v, 0) / as.length) : null,
      rango1991_2020: null, // A range string stops making sense once averaged across many veredas' distinct bands.
      mm1981_2010: bs.length > 0 ? Math.round(bs.reduce((sum, v) => sum + v, 0) / bs.length) : null,
      rango1981_2010: null,
    }
  })
}

/** Averages a batch of per-vereda current-year series into one, skipping any vereda that failed to resolve. */
function averageCurrentYear(batch: Array<CurrentYearMonthlyPoint[] | null>): CurrentYearMonthlyPoint[] {
  const valid = batch.filter((series): series is CurrentYearMonthlyPoint[] => series != null)
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const values = valid.map((s) => s[i]?.mm).filter((v): v is number => v != null)
    return {
      month,
      mm: values.length > 0 ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : null,
      validDays: Math.max(...valid.map((s) => s[i]?.validDays ?? 0), 0),
      isPartial: valid.some((s) => s[i]?.isPartial),
    }
  })
}

function mergeMeses(
  climatology: MonthlyClimatologyPoint[],
  currentYear: CurrentYearMonthlyPoint[],
  aniosHistoricos: number[],
  historicoSeries: CurrentYearMonthlyPoint[][],
): ClimatologiaMesPunto[] {
  return climatology.map((m, i) => ({
    ...m,
    mmActual: currentYear[i]?.mm ?? null,
    esMesEnCurso: currentYear[i]?.isPartial ?? false,
    historico: aniosHistoricos.map((anio, yi) => ({ anio, mm: historicoSeries[yi]?.[i]?.mm ?? null })),
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const codigoVereda = searchParams.get("codigoVereda")
  const municipio = searchParams.get("municipio")

  if (!codigoVereda && !municipio) {
    const body: ClimatologiaErrorResponse = { error: "Falta el parámetro codigoVereda o municipio." }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const now = new Date()
    const aniosHistoricos = getRecentPastYears(3, now)
    let body: ClimatologiaResponse

    if (municipio) {
      const match = await getMunicipioCentroids(municipio)
      if (!match) {
        const errorBody: ClimatologiaErrorResponse = { error: "Municipio no encontrado." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [climatologyBatch, currentYearBatch, historicoBatches] = await Promise.all([
        getMonthlyClimatologyBatch(match.centroids),
        getCurrentYearMonthlyPrecipitationBatch(match.centroids),
        Promise.all(aniosHistoricos.map((anio) => getYearMonthlyPrecipitationBatch(match.centroids, anio))),
      ])
      body = {
        scope: "municipio",
        ubicacion: { nombre: match.nombre, municipio: match.nombre, veredasPromediadas: match.centroids.length },
        generatedAt: now.toISOString(),
        mesEnCurso: now.getUTCMonth() + 1,
        aniosHistoricos,
        meses: mergeMeses(
          averageClimatology(climatologyBatch),
          averageCurrentYear(currentYearBatch),
          aniosHistoricos,
          historicoBatches.map((batch) => averageCurrentYear(batch)),
        ),
      }
    } else {
      const vereda = await getVeredaCentroidByCode(codigoVereda!)
      if (!vereda) {
        const errorBody: ClimatologiaErrorResponse = { error: "Vereda no encontrada." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [climatology, currentYear, historicoSeries] = await Promise.all([
        getMonthlyClimatology(vereda.lon, vereda.lat),
        getCurrentYearMonthlyPrecipitation(vereda.lon, vereda.lat),
        Promise.all(aniosHistoricos.map((anio) => getYearMonthlyPrecipitation(vereda.lon, vereda.lat, anio))),
      ])
      body = {
        scope: "vereda",
        ubicacion: { nombre: vereda.nombre, municipio: vereda.municipio, codigoVereda: codigoVereda! },
        generatedAt: now.toISOString(),
        mesEnCurso: now.getUTCMonth() + 1,
        aniosHistoricos,
        meses: mergeMeses(climatology, currentYear, aniosHistoricos, historicoSeries),
      }
    }

    return NextResponse.json(body)
  } catch (err) {
    const body: ClimatologiaErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la climatología de IDEAM.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
