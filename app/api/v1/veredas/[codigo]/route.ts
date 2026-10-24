import type { NextRequest } from "next/server"
import { fail, ok, preflight } from "@/lib/api/v1"
import { getRiesgoFeatures, shapeRiesgo } from "@/lib/api/riesgo"

export const maxDuration = 60
export const OPTIONS = preflight

export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const conGeometria = request.nextUrl.searchParams.get("geometria") === "true"

  try {
    const feature = (await getRiesgoFeatures()).find((f) => f.properties.codigoVereda === codigo)
    if (!feature) return fail(404, "not_found", `No existe la vereda con código ${codigo}.`)

    const riesgo = shapeRiesgo(feature)
    return ok(conGeometria ? { ...riesgo, geometria: feature.geometry } : riesgo, { cacheSeconds: 600 })
  } catch {
    return fail(502, "upstream_error", "No se pudo calcular el riesgo de la vereda.")
  }
}
