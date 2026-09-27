import { NextResponse } from "next/server"
import { getBarrioBoundaries } from "@/lib/barrios/boundaries"
import type { BarriosErrorResponse, BarriosResponse } from "@/lib/barrios/api-types"

export async function GET() {
  try {
    const boundaries = await getBarrioBoundaries()
    const body: BarriosResponse = {
      generatedAt: new Date().toISOString(),
      barrios: {
        type: "FeatureCollection",
        features: boundaries.map((b) => ({
          type: "Feature",
          properties: {
            id: b.id,
            nombre: b.nombre,
            municipio: b.municipio,
            estado: b.estado,
            frecuenciaInundacion: b.frecuenciaInundacion,
            frecuenciaMovimientoMasa: b.frecuenciaMovimientoMasa,
          },
          geometry: b.geometry,
        })),
      },
      source: "Dashboard SIRD Sevilla (post-sismo)",
      sourceUrl: "https://www.arcgis.com/apps/dashboards/fae212e5ccee4615a6b9401472c651e6",
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: BarriosErrorResponse = {
      error: err instanceof Error ? err.message : "Error inesperado al consultar los barrios de Sevilla.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
