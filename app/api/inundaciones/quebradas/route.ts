import { NextResponse } from "next/server"
import { getStreamTraces } from "@/lib/inundaciones/streams"
import { QUEBRADA_SAN_JOSE_OSM } from "@/lib/inundaciones/quebradas-osm"
import type {
  InundacionesQuebradasErrorResponse,
  InundacionesQuebradasResponse,
  QuebradasFeatureCollection,
} from "@/lib/inundaciones/api-types"

/**
 * Named stream/river line layer for the map — the 19 ArcGIS "Quebradas"
 * traces (see lib/inundaciones/streams.ts) plus one OSM-sourced trace,
 * "Quebrada San José" (see lib/inundaciones/quebradas-osm.ts), which
 * isn't in the ArcGIS layer.
 *
 * Display only: this route doesn't feed the flood hazard model's
 * stream-proximity factor, which already reuses `getStreamTraces()`
 * directly server-side (see hazard-model.ts) — adding the map's display
 * layer here doesn't change that factor's inputs.
 */
export async function GET() {
  try {
    const arcgisTraces = await getStreamTraces()

    const features: QuebradasFeatureCollection["features"] = [
      ...arcgisTraces
        .filter((t) => t.nombre)
        .map((t) => ({
          type: "Feature" as const,
          properties: { nombre: t.nombre as string, source: "arcgis" as const, rivid: t.rivid },
          geometry: { type: "MultiLineString" as const, coordinates: t.paths },
        })),
      {
        type: "Feature" as const,
        properties: { nombre: QUEBRADA_SAN_JOSE_OSM.nombre, source: "osm" as const, rivid: QUEBRADA_SAN_JOSE_OSM.rivid },
        geometry: { type: "MultiLineString" as const, coordinates: QUEBRADA_SAN_JOSE_OSM.paths },
      },
    ]

    const body: InundacionesQuebradasResponse = {
      generatedAt: new Date().toISOString(),
      lines: { type: "FeatureCollection", features },
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: InundacionesQuebradasErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar la capa de quebradas y ríos.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
