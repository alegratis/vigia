import { NextResponse, type NextRequest } from "next/server"
import { buildExportUrl, type LatLngBounds } from "@/lib/geoglows/live-map"

/**
 * Same-origin proxy for GEOGLOWS' ArcGIS export-image endpoint
 * (lib/geoglows/live-map.ts's buildExportUrl). components/maps/geoglows-live-map.tsx
 * loads that URL directly since it's just rendered as a Leaflet ImageOverlay —
 * a normal <img> load doesn't care about CORS. But the exposición popup's
 * map (components/maps/exposicion-map.tsx) needs to rasterize the whole map
 * into a canvas for PDF export via html2canvas, which taints (and then
 * silently drops) any cross-origin image lacking CORS headers. ArcGIS's
 * export endpoint doesn't send `Access-Control-Allow-Origin`, so this route
 * re-fetches the image server-side and re-serves it from this app's own
 * origin instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const north = Number(searchParams.get("north"))
  const south = Number(searchParams.get("south"))
  const east = Number(searchParams.get("east"))
  const west = Number(searchParams.get("west"))
  const width = Number(searchParams.get("width"))
  const height = Number(searchParams.get("height"))

  if (![north, south, east, west, width, height].every(Number.isFinite)) {
    return NextResponse.json({ error: "Parámetros de exportación inválidos." }, { status: 400 })
  }

  const bounds: LatLngBounds = { north, south, east, west }
  const upstreamUrl = buildExportUrl(bounds, width, height)

  try {
    const upstreamRes = await fetch(upstreamUrl)
    if (!upstreamRes.ok) {
      return NextResponse.json({ error: "No se pudo obtener la imagen de GEOGLOWS." }, { status: 502 })
    }
    const buffer = await upstreamRes.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": upstreamRes.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=60",
      },
    })
  } catch {
    return NextResponse.json({ error: "No se pudo contactar el servicio de GEOGLOWS." }, { status: 502 })
  }
}
