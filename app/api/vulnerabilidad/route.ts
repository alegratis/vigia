import { NextResponse } from "next/server"
import { getHousingVulnerabilityIndex, getUrbanHviByMunicipio } from "@/lib/vulnerabilidad/hvi"
import { computeCombinedVulnerability } from "@/lib/vulnerabilidad/combined-score"
import { getRiesgoCompuestoVeredas } from "@/lib/riesgo-compuesto/server"
import { isCompoundLevel } from "@/lib/riesgo-compuesto/levels"
import type {
  VulnerabilidadResponse,
  VulnerabilidadErrorResponse,
  ManzanaVulnerabilidadFeatureCollection,
} from "@/lib/vulnerabilidad/api-types"

const SOURCE =
  "DANE (IPM 2018 a nivel manzana en cascos urbanos; déficit habitacional 2018 a nivel municipio en veredas rurales) combinado con el modelo de riesgo compuesto de esta app"
const SOURCE_URL = "https://geoportal.dane.gov.co/"

/**
 * Joins per-vereda riesgo-compuesto results with HVI — vereda → municipio
 * via the existing vereda feature's `properties.municipio`, no new spatial
 * join needed, the vereda data already carries its municipio name (see
 * lib/vulnerabilidad/combined-score.ts for the formula). Each municipio's
 * "Casco Urbano" pseudo-vereda gets the manzana-derived urban HVI instead
 * of the coarser municipio-wide one, since that's the finer resolution
 * DANE actually supports there (see lib/vulnerabilidad/hvi.ts).
 */
export async function GET() {
  try {
    const [hviRows, urbanHviRows, compound] = await Promise.all([
      getHousingVulnerabilityIndex(),
      getUrbanHviByMunicipio(),
      getRiesgoCompuestoVeredas(),
    ])

    const hviByMunicipio = new Map(hviRows.map((row) => [row.municipio.toUpperCase(), row.hvi]))

    // Urban cores are rendered manzana-by-manzana below, so the vereda layer
    // keeps only rural veredas — each still a single, honest municipio-wide value.
    const features: VulnerabilidadResponse["veredas"]["features"] = compound.features
      .filter((feature) => !feature.properties.esCascoUrbano)
      .map((feature) => {
        const municipioKey = feature.properties.municipio.toUpperCase()
        const hvi = hviByMunicipio.get(municipioKey) ?? 0.5
        const compoundLevel = isCompoundLevel(feature.properties.compoundLevel ?? "")
          ? feature.properties.compoundLevel
          : null
        const result = computeCombinedVulnerability({ hvi, compoundLevel })

        return {
          type: "Feature",
          id: feature.id,
          properties: {
            codigoVereda: feature.properties.codigoVereda,
            nombre: feature.properties.nombre,
            municipio: feature.properties.municipio,
            esCascoUrbano: feature.properties.esCascoUrbano,
            hvi: result.hvi,
            hviResolution: "municipio" as const,
            hazardScore: result.hazardScore,
            combinedScore: result.combinedScore,
            combinedLevel: result.combinedLevel,
            compoundLevel: feature.properties.compoundLevel,
          },
          geometry: feature.geometry,
        }
      })

    // Each "Casco Urbano" pseudo-vereda carries the urban core's hazard tier
    // — every manzana inside it shares that same physical-hazard exposure,
    // so we fan it out to each manzana's own HVI instead of one shared value.
    const cascoCompoundLevelByMunicipio = new Map(
      compound.features
        .filter((feature) => feature.properties.esCascoUrbano)
        .map((feature) => [feature.properties.municipio.toUpperCase(), feature.properties.compoundLevel ?? null]),
    )

    const manzanaFeatures: ManzanaVulnerabilidadFeatureCollection["features"] = urbanHviRows.flatMap((row) => {
      const rawCompoundLevel = cascoCompoundLevelByMunicipio.get(row.municipio.toUpperCase()) ?? null
      const compoundLevel = isCompoundLevel(rawCompoundLevel ?? "") ? rawCompoundLevel : null
      return row.manzanas.map((manzana) => {
        const result = computeCombinedVulnerability({ hvi: manzana.hvi, compoundLevel })
        return {
          type: "Feature",
          id: `${row.codigoMunicipio}-${manzana.codigoManzana}`,
          properties: {
            codigoManzana: manzana.codigoManzana,
            barrio: manzana.barrio,
            codigoMunicipio: row.codigoMunicipio,
            municipio: row.municipio,
            hvi: result.hvi,
            hazardScore: result.hazardScore,
            combinedScore: result.combinedScore,
            combinedLevel: result.combinedLevel,
            compoundLevel: rawCompoundLevel,
          },
          geometry: manzana.geometry,
        }
      })
    })

    const body: VulnerabilidadResponse = {
      generatedAt: new Date().toISOString(),
      veredas: { type: "FeatureCollection", features },
      manzanas: { type: "FeatureCollection", features: manzanaFeatures },
      hviPorMunicipio: hviRows,
      hviUrbanoPorMunicipio: urbanHviRows,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: VulnerabilidadErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al calcular el índice de vulnerabilidad.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
