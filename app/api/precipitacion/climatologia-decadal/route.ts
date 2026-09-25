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
  getDecadaBins,
  getDecadaMonthlyClimatology,
  getDecadaMonthlyClimatologyBatch,
  type DecadaSeries,
} from "@/lib/precipitacion/openmeteo-decadal-climatology"
import type { ClimatologiaDecadalErrorResponse, ClimatologiaDecadalResponse, DecadaMesPunto } from "@/lib/precipitacion/api-types"

/** Averages a batch of per-vereda 10-year-bin series into one, skipping any vereda that failed to resolve. */
function averageDecadas(batch: Array<DecadaSeries[] | null>): DecadaSeries[] {
  const valid = batch.filter((series): series is DecadaSeries[] => series != null)
  if (valid.length === 0) return []
  // Every vereda's series was built from the same getDecadaBins call, so the bin boundaries line up positionally.
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
  decadas: DecadaSeries[],
  currentYear: CurrentYearMonthlyPoint[],
  aniosRecientes: number[],
  recentSeries: CurrentYearMonthlyPoint[][],
): DecadaMesPunto[] {
  return MONTH_LABELS_ES.map((monthLabel, i) => ({
    month: i + 1,
    monthLabel,
    decadas: decadas.map((d) => ({ inicio: d.inicio, fin: d.fin, mm: d.meses[i]?.mm ?? null })),
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
    const body: ClimatologiaDecadalErrorResponse = { error: "Falta el parámetro codigoVereda o municipio." }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const now = new Date()
    // The two calendar years right before this one, shown individually rather than folded into a bin —
    // see getDecadaBins for why the bins stop 3 years short of the current year.
    const aniosRecientes = getRecentPastYears(2, now)
    const decadas = getDecadaBins(now)
    let body: ClimatologiaDecadalResponse

    if (municipio) {
      const match = await getMunicipioCentroids(municipio)
      if (!match) {
        const errorBody: ClimatologiaDecadalErrorResponse = { error: "Municipio no encontrado." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [decadaBatch, currentYearBatch, recentBatches] = await Promise.all([
        getDecadaMonthlyClimatologyBatch(match.centroids, now),
        getCurrentYearMonthlyPrecipitationBatch(match.centroids),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyPrecipitationBatch(match.centroids, anio))),
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
          averageYearMonthlySeries(currentYearBatch),
          aniosRecientes,
          recentBatches.map((batch) => averageYearMonthlySeries(batch)),
        ),
      }
    } else {
      const vereda = await getVeredaCentroidByCode(codigoVereda!)
      if (!vereda) {
        const errorBody: ClimatologiaDecadalErrorResponse = { error: "Vereda no encontrada." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [decadaSeries, currentYear, recentSeries] = await Promise.all([
        getDecadaMonthlyClimatology(vereda.lon, vereda.lat, now),
        getCurrentYearMonthlyPrecipitation(vereda.lon, vereda.lat),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyPrecipitation(vereda.lon, vereda.lat, anio))),
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
    const body: ClimatologiaDecadalErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la climatología decadal de Open-Meteo.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
