import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { buildOpenApiSpec } from "@/lib/api/openapi"
import { preflight } from "@/lib/api/v1"

export const OPTIONS = preflight

export async function GET(request: NextRequest) {
  return NextResponse.json(buildOpenApiSpec(request.nextUrl.origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
