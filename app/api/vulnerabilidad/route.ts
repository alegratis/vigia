import { NextResponse } from "next/server"
import { getHousingVulnerabilityIndex, getUrbanHviByMunicipio } from "@/lib/vulnerabilidad/hvi"
import { computeCombinedVulnerability } from "@/lib/vulnerabilidad/combined-score"
import { getRiesgoCompuestoVeredas } from "@/lib/riesgo-compuesto/server"
import { isCompoundLevel } from "@/lib/riesgo-compuesto/levels"
import type { VulnerabilidadResponse, VulnerabilidadErrorResponse } from "@/lib/vulnerabilidad/api-types"

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
    const urbanHviByMunicipio = new Map(urbanHviRows.map((row) => [row.municipio.toUpperCase(), row.hvi]))

    const features: VulnerabilidadResponse["veredas"]["features"] = compound.features.map((feature) => {
      const municipioKey = feature.properties.municipio.toUpperCase()
      const isUrbano = Boolean(feature.properties.esCascoUrbano)
      const urbanHvi = isUrbano ? urbanHviByMunicipio.get(municipioKey) : undefined
      const hvi = urbanHvi ?? hviByMunicipio.get(municipioKey) ?? 0.5
      const hviResolution = urbanHvi != null ? "manzana" : "municipio"
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
          hviResolution,
          hazardScore: result.hazardScore,
          combinedScore: result.combinedScore,
          combinedLevel: result.combinedLevel,
          compoundLevel: feature.properties.compoundLevel,
        },
        geometry: feature.geometry,
      }
    })

    const body: VulnerabilidadResponse = {
      generatedAt: new Date().toISOString(),
      veredas: { type: "FeatureCollection", features },
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
