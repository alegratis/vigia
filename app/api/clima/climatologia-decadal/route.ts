import { NextResponse } from "next/server"
import { getMunicipioCascoUrbano, getVeredaCentroidByCode } from "@/lib/clima/server"
import { MONTH_LABELS_ES } from "@/lib/clima/api-types"
import {
  getCurrentYearMonthlyTemperature,
  getRecentPastYears,
  getYearMonthlyTemperature,
  type CurrentYearMonthlyTempPoint,
} from "@/lib/clima/openmeteo-historical-client"
import { getDecadaBins, getDecadaMonthlyTempClimatology, type DecadaTempSeries } from "@/lib/clima/openmeteo-decadal-climatology"
import type {
  ClimaClimatologiaDecadalErrorResponse,
  ClimaClimatologiaDecadalResponse,
  TempDecadaMesPunto,
} from "@/lib/clima/api-types"

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
    tempMeanActual: currentYear[i]?.tempMeanC ?? null,
    tempMaxActual: currentYear[i]?.tempMaxC ?? null,
    tempMinActual: currentYear[i]?.tempMinC ?? null,
    sensacionActual: currentYear[i]?.sensacionC ?? null,
    esMesEnCurso: currentYear[i]?.isPartial ?? false,
    reciente: aniosRecientes.map((anio, yi) => ({ anio, tempC: recentSeries[yi]?.[i]?.tempMeanC ?? null })),
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
      // Uses the municipio's own "Casco Urbano" point rather than averaging every rural vereda: Sevilla's
      // territory spans lowland valley floor to cool highland terrain, and the population — concentrated in
      // the urban core — experiences the casco urbano's climate, not a blend skewed cooler by the mountains.
      const match = await getMunicipioCascoUrbano(municipio)
      if (!match) {
        const errorBody: ClimaClimatologiaDecadalErrorResponse = { error: "Municipio no encontrado." }
        return NextResponse.json(errorBody, { status: 404 })
      }
      const [decadaSeries, currentYear, recentSeries] = await Promise.all([
        getDecadaMonthlyTempClimatology(match.lon, match.lat, now),
        getCurrentYearMonthlyTemperature(match.lon, match.lat),
        Promise.all(aniosRecientes.map((anio) => getYearMonthlyTemperature(match.lon, match.lat, anio))),
      ])
      body = {
        scope: "municipio",
        ubicacion: { nombre: match.nombre, municipio: match.nombre },
        generatedAt: now.toISOString(),
        mesEnCurso: now.getUTCMonth() + 1,
        decadas,
        aniosRecientes,
        meses: mergeMeses(decadaSeries, currentYear, aniosRecientes, recentSeries),
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
