import { NextResponse } from "next/server"
import { getLandslideRecords } from "@/lib/deslizamientos/landslide-inventory"
import { resolveRegion } from "@/lib/lugares/region"
import { arcgisEnvelope } from "@/lib/lugares/geo-bbox"
import type {
  LandslideInventoryErrorResponse,
  LandslideInventoryResponse,
} from "@/lib/deslizamientos/landslide-inventory-types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const region = resolveRegion(searchParams.get("municipio"))

  try {
    const records = await getLandslideRecords(arcgisEnvelope(region.bounds))
    const body: LandslideInventoryResponse = {
      generatedAt: new Date().toISOString(),
      records,
    }
    return NextResponse.json(body)
  } catch (err) {
    const body: LandslideInventoryErrorResponse = {
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al consultar el inventario de movimientos en masa.",
    }
    return NextResponse.json(body, { status: 502 })
  }
}
