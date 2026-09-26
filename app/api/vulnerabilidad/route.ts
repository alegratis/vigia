import { NextResponse } from "next/server"
import { getHousingVulnerabilityIndex } from "@/lib/vulnerabilidad/hvi"
import { computeCombinedVulnerability } from "@/lib/vulnerabilidad/combined-score"
import { getRiesgoCompuestoVeredas } from "@/lib/riesgo-compuesto/server"
import { isCompoundLevel } from "@/lib/riesgo-compuesto/levels"
import type { VulnerabilidadResponse, VulnerabilidadErrorResponse } from "@/lib/vulnerabilidad/api-types"

const SOURCE = "DANE (déficit habitacional 2018) combinado con el modelo de riesgo compuesto de esta app"
const SOURCE_URL = "https://geoportal.dane.gov.co/"

/**
 * Joins per-vereda riesgo-compuesto results with per-municipio HVI —
 * vereda → municipio via the existing vereda feature's `properties.municipio`,
 * no new spatial join needed, the vereda data already carries its
 * municipio name (see lib/vulnerabilidad/combined-score.ts for the formula).
 */
export async function GET() {
  try {
    const [hviRows, compound] = await Promise.all([getHousingVulnerabilityIndex(), getRiesgoCompuestoVeredas()])

    const hviByMunicipio = new Map(hviRows.map((row) => [row.municipio.toUpperCase(), row.hvi]))

    const features: VulnerabilidadResponse["veredas"]["features"] = compound.features.map((feature) => {
      const hvi = hviByMunicipio.get(feature.properties.municipio.toUpperCase()) ?? 0.5
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
