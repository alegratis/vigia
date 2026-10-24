import type { NextRequest } from "next/server"
import { fail, normalizeName, ok, preflight } from "@/lib/api/v1"
import { getRiesgoFeatures, shapeRiesgo } from "@/lib/api/riesgo"

export const maxDuration = 60
export const OPTIONS = preflight

const ACTION_RANK: Record<string, number> = { informar: 0, prepararse: 1, actuar: 2 }

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  const municipio = query.get("municipio")
  const accion = query.get("accion")?.toLowerCase() ?? null
  const formato = query.get("formato") ?? "json"

  if (accion !== null && !(accion in ACTION_RANK)) {
    return fail(400, "invalid_parameter", "El parámetro accion debe ser informar, prepararse o actuar.")
  }
  if (formato !== "json" && formato !== "geojson") {
    return fail(400, "invalid_parameter", "El parámetro formato debe ser json o geojson.")
  }

  try {
    const wanted = municipio ? normalizeName(municipio) : null
    const minRank = accion === null ? 0 : ACTION_RANK[accion]

    const features = (await getRiesgoFeatures()).filter((f) => {
      if (wanted !== null && normalizeName(f.properties.municipio) !== wanted) return false
      const rank = f.properties.actionTier ? ACTION_RANK[f.properties.actionTier.toLowerCase()] : -1
      return rank >= minRank
    })

    if (formato === "geojson") {
      const collection = {
        type: "FeatureCollection" as const,
        features: features.map((f) => ({
          type: "Feature" as const,
          id: f.id,
          properties: shapeRiesgo(f),
          geometry: f.geometry,
        })),
      }
      return ok(collection, { cacheSeconds: 600, meta: { total: features.length } })
    }

    return ok(features.map(shapeRiesgo), { cacheSeconds: 600, meta: { total: features.length } })
  } catch {
    return fail(502, "upstream_error", "No se pudo calcular el riesgo compuesto.")
  }
}
