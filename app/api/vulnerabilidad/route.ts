import { NextResponse } from "next/server"
import { getSocialVulnerabilityIndex, getUrbanIvsByMunicipio } from "@/lib/vulnerabilidad/ivs"
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
 * Joins per-vereda riesgo-compuesto results with IVS — vereda → municipio
 * via the existing vereda feature's `properties.municipio`, no new spatial
 * join needed, the vereda data already carries its municipio name (see
 * lib/vulnerabilidad/combined-score.ts for the formula). Each municipio's
 * "Casco Urbano" pseudo-vereda gets the manzana-derived urban IVS instead
 * of the coarser municipio-wide one, since that's the finer resolution
 * DANE actually supports there (see lib/vulnerabilidad/ivs.ts).
 */
export async function GET() {
  try {
    const [ivsRows, urbanIvsRows, compound] = await Promise.all([
      getSocialVulnerabilityIndex(),
      getUrbanIvsByMunicipio(),
      getRiesgoCompuestoVeredas(),
    ])

    const ivsByMunicipio = new Map(ivsRows.map((row) => [row.municipio.toUpperCase(), row.ivs]))

    // Urban cores are rendered manzana-by-manzana below, so the vereda layer
    // keeps only rural veredas — each still a single, honest municipio-wide value.
    const features: VulnerabilidadResponse["veredas"]["features"] = compound.features
      .filter((feature) => !feature.properties.esCascoUrbano)
      .map((feature) => {
        const municipioKey = feature.properties.municipio.toUpperCase()
        const ivs = ivsByMunicipio.get(municipioKey) ?? 0.5
        const compoundLevel = isCompoundLevel(feature.properties.compoundLevel ?? "")
          ? feature.properties.compoundLevel
          : null
        const result = computeCombinedVulnerability({ ivs, compoundLevel })

        return {
          type: "Feature",
          id: feature.id,
          properties: {
            codigoVereda: feature.properties.codigoVereda,
            nombre: feature.properties.nombre,
            municipio: feature.properties.municipio,
            esCascoUrbano: feature.properties.esCascoUrbano,
            ivs: result.ivs,
            ivsResolution: "municipio" as const,
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
    // so we fan it out to each manzana's own IVS instead of one shared value.
    const cascoCompoundLevelByMunicipio = new Map(
      compound.features
        .filter((feature) => feature.properties.esCascoUrbano)
        .map((feature) => [feature.properties.municipio.toUpperCase(), feature.properties.compoundLevel ?? null]),
    )

    const manzanaFeatures: ManzanaVulnerabilidadFeatureCollection["features"] = urbanIvsRows.flatMap((row) => {
      const rawCompoundLevel = cascoCompoundLevelByMunicipio.get(row.municipio.toUpperCase()) ?? null
      const compoundLevel = isCompoundLevel(rawCompoundLevel ?? "") ? rawCompoundLevel : null
      return row.manzanas.map((manzana) => {
        const result = computeCombinedVulnerability({ ivs: manzana.ivs, compoundLevel })
        return {
          type: "Feature",
          id: `${row.codigoMunicipio}-${manzana.codigoManzana}`,
          properties: {
            codigoManzana: manzana.codigoManzana,
            barrio: manzana.barrio,
            codigoMunicipio: row.codigoMunicipio,
            municipio: row.municipio,
            ivs: result.ivs,
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
      ivsPorMunicipio: ivsRows,
      ivsUrbanoPorMunicipio: urbanIvsRows,
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
