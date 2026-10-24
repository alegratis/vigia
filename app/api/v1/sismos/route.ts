import type { NextRequest } from "next/server"
import { fail, ok, preflight, readFloat, readInt } from "@/lib/api/v1"
import { getSismologiaEventos } from "@/lib/sismologia/server"
import { isSameQuake } from "@/lib/sismologia/latest-events"
import type { SeismicEvent } from "@/lib/sismologia/api-types"

export const maxDuration = 30
export const OPTIONS = preflight

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  const minMagnitud = readFloat(query.get("minMagnitud"), 0, 0, 10)
  const dias = readInt(query.get("dias"), 7, 1, 30)
  const limite = readInt(query.get("limite"), 50, 1, 200)

  if (minMagnitud === null) return fail(400, "invalid_parameter", "minMagnitud debe ser un número entre 0 y 10.")
  if (dias === null) return fail(400, "invalid_parameter", "dias debe ser un entero entre 1 y 30.")
  if (limite === null) return fail(400, "invalid_parameter", "limite debe ser un entero entre 1 y 200.")

  try {
    const data = await getSismologiaEventos()
    const since = Date.now() - dias * 86_400_000

    // SGC va primero para que prevalezca cuando ambos catálogos reportan el mismo sismo.
    const candidates = [...data.sgcLive.events, ...data.usgs.events]
      .filter((e) => e.magnitude >= minMagnitud && new Date(e.time).getTime() >= since)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    const distinct: SeismicEvent[] = []
    for (const event of candidates) {
      if (distinct.some((kept) => isSameQuake(kept, event))) continue
      distinct.push(event)
      if (distinct.length === limite) break
    }

    const sismos = distinct.map((e) => ({
      id: e.id,
      fuente: e.source === "usgs" ? "USGS" : "SGC",
      fecha: e.time,
      magnitud: e.magnitude,
      profundidadKm: e.depthKm,
      lat: e.lat,
      lon: e.lon,
      lugar: e.place,
      revision: e.reviewStatus ?? null,
    }))

    return ok(sismos, {
      cacheSeconds: 120,
      meta: {
        total: sismos.length,
        areaConsultada: {
          sur: data.bbox.south,
          oeste: data.bbox.west,
          norte: data.bbox.north,
          este: data.bbox.east,
        },
      },
    })
  } catch {
    return fail(502, "upstream_error", "No se pudo consultar la actividad sísmica.")
  }
}
