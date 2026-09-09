import { NextResponse } from "next/server"
import { getLandslideRecords } from "@/lib/deslizamientos/landslide-inventory"
import type {
  LandslideInventoryErrorResponse,
  LandslideInventoryResponse,
} from "@/lib/deslizamientos/landslide-inventory-types"

export async function GET() {
  try {
    const records = await getLandslideRecords()
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
