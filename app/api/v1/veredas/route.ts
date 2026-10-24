import type { NextRequest } from "next/server"
import { fail, normalizeName, ok, preflight } from "@/lib/api/v1"
import { getVeredaList } from "@/lib/veredas/list"

export const maxDuration = 30
export const OPTIONS = preflight

export async function GET(request: NextRequest) {
  const municipio = request.nextUrl.searchParams.get("municipio")

  try {
    const entries = await getVeredaList()
    const wanted = municipio ? normalizeName(municipio) : null
    const veredas = entries
      .filter((e) => wanted === null || normalizeName(e.municipio) === wanted)
      .map((e) => ({
        codigoVereda: e.codigoVereda,
        nombre: e.nombre,
        municipio: e.municipio,
        esCascoUrbano: e.esCascoUrbano ?? false,
        bbox: { sur: e.bbox[0], oeste: e.bbox[1], norte: e.bbox[2], este: e.bbox[3] },
        centro: { lat: e.center[0], lon: e.center[1] },
      }))

    return ok(veredas, { cacheSeconds: 86_400, meta: { total: veredas.length } })
  } catch {
    return fail(502, "upstream_error", "No se pudo consultar el listado de veredas.")
  }
}
