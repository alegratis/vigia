/** Client-safe response shapes for /api/osm/infraestructura. No server imports. */

import type { OsmCategoryKey } from "./categories"

export interface OsmPoint {
  id: string
  lat: number
  lon: number
  category: OsmCategoryKey
  name: string | null
}

export interface OsmInfrastructureResponse {
  generatedAt: string
  points: OsmPoint[]
}

export interface OsmInfrastructureErrorResponse {
  error: string
}
