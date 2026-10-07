import "server-only"

import { centroid } from "@turf/centroid"
import { multiPolygon } from "@turf/helpers"
import { getVeredaBoundaries } from "@/lib/veredas/boundaries"
import { MUNICIPIOS } from "@/lib/demografia/categories"
import { getWeatherPointBatch } from "./weather-client"
import { weatherGroupFromCode } from "./weather-codes"
import {
  CLIMA_FORECAST_DAYS,
  classifyTemp,
  type ClimaDay,
  type ClimaFeatureCollection,
  type ClimaMunicipioResumen,
} from "./api-types"

function round1(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10) / 10 : null
}

/** Counts leading dry days: how many days from the start of the forecast are dry before the first wet day. */
function countRachaSeca(secoFlags: boolean[]): number {
  let count = 0
  for (const seco of secoFlags) {
    if (!seco) break
    count++
  }
  return count
}

/**
 * Builds the vereda-level clima GeoJSON for /api/clima/forecast. Reuses the
 * same vereda boundaries and centroid math as the precipitación layer (see
 * lib/precipitacion/server.ts) and queries Open-Meteo once per centroid for a
 * conventional weather report (lib/clima/weather-client.ts): current
 * conditions, a temperature band, a 7-day forecast and a short dry-spell
 * outlook. Municipality headlines are taken from each cabecera's ("Casco
 * Urbano") own weather point so the map shows one prominent
 * current-conditions marker per town.
 */
export async function getClimaForecast(): Promise<{
  forecastDays: number
  municipios: ClimaMunicipioResumen[]
  veredas: ClimaFeatureCollection
}> {
  const boundaries = await getVeredaBoundaries()

  const centroids = boundaries.map((b) => {
    const [lon, lat] = centroid(multiPolygon(b.polygons)).geometry.coordinates
    return { lon, lat }
  })

  const weatherPoints = await getWeatherPointBatch(centroids)

  const features: ClimaFeatureCollection["features"] = boundaries.map((boundary, i) => {
    const w = weatherPoints[i]
    const dias: ClimaDay[] = (w?.dias ?? []).map((d) => ({
      fecha: d.fecha,
      weatherCode: d.weatherCode,
      grupo: weatherGroupFromCode(d.weatherCode),
      tempMax: round1(d.tempMax),
      tempMin: round1(d.tempMin),
      probabilidadLluvia: Math.round(d.probabilidadLluvia),
      precipMm: Math.round(d.precipMm * 10) / 10,
      seco: d.precipMm < 1,
    }))
    const rachaSeca = countRachaSeca(dias.map((d) => d.seco))
    const tempActual = round1(w?.currentTemp)

    return {
      type: "Feature",
      id: boundary.codigoVereda,
      properties: {
        codigoVereda: boundary.codigoVereda,
        nombre: boundary.nombre,
        municipio: boundary.municipio,
        esCascoUrbano: boundary.esCascoUrbano,
        tempActual,
        sensacionTermica: round1(w?.currentApparent),
        weatherCodeActual: w?.currentCode ?? null,
        grupoActual: w?.currentCode != null ? weatherGroupFromCode(w.currentCode) : null,
        esDia: w?.esDia ?? true,
        tempMaxHoy: round1(dias[0]?.tempMax),
        tempMinHoy: round1(dias[0]?.tempMin),
        nivelTemp: tempActual != null ? classifyTemp(tempActual) : null,
        dias,
        rachaSeca,
      },
      geometry: { type: "MultiPolygon", coordinates: boundary.polygons },
    }
  })

  const municipios: ClimaMunicipioResumen[] = []
  for (const m of MUNICIPIOS) {
    const idx = boundaries.findIndex(
      (b) => b.esCascoUrbano && b.municipio.toLowerCase() === m.toLowerCase(),
    )
    if (idx === -1) continue
    const w = weatherPoints[idx]
    const c = centroids[idx]
    municipios.push({
      municipio: m,
      lat: c.lat,
      lon: c.lon,
      tempActual: round1(w?.currentTemp),
      grupoActual: w?.currentCode != null ? weatherGroupFromCode(w.currentCode) : null,
      esDia: w?.esDia ?? true,
      tempMax: round1(w?.dias?.[0]?.tempMax),
      tempMin: round1(w?.dias?.[0]?.tempMin),
    })
  }

  return {
    forecastDays: CLIMA_FORECAST_DAYS,
    municipios,
    veredas: { type: "FeatureCollection", features },
  }
}

/**
 * Looks up one vereda's centroid by its `codigoVereda`, for the clima
 * climatology routes — same boundaries fetch and centroid math as
 * getClimaForecast above, just for a single vereda.
 */
export async function getVeredaCentroidByCode(
  codigoVereda: string,
): Promise<{ lon: number; lat: number; nombre: string; municipio: string } | null> {
  const boundaries = await getVeredaBoundaries()
  const boundary = boundaries.find((b) => b.codigoVereda === codigoVereda)
  if (!boundary) return null
  const [lon, lat] = centroid(multiPolygon(boundary.polygons)).geometry.coordinates
  return { lon, lat, nombre: boundary.nombre, municipio: boundary.municipio }
}

/**
 * Looks up one municipio's "Casco Urbano" pseudo-vereda centroid, for the
 * clima climatology routes' municipio-scoped queries. Sevilla in particular
 * spans lowland valley floor to cool highland terrain, so averaging every
 * rural vereda skews the temperature trend cooler than what most of the
 * population — concentrated in the urban core — actually experiences.
 * Matching is case-insensitive.
 */
export async function getMunicipioCascoUrbano(
  municipio: string,
): Promise<{ lon: number; lat: number; nombre: string } | null> {
  const boundaries = await getVeredaBoundaries()
  const target = municipio.trim().toLowerCase()
  const match = boundaries.find((b) => b.esCascoUrbano && b.municipio.toLowerCase() === target)
  if (!match) return null
  const [lon, lat] = centroid(multiPolygon(match.polygons)).geometry.coordinates
  return { lon, lat, nombre: match.nombre }
}
