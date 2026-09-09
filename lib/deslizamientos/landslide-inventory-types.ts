/**
 * Client-safe types for /api/deslizamientos/inventario — the SGC
 * historical mass-movement inventory (see landslide-inventory.ts for the
 * server fetcher and the hazard-model factor that also reuses it). No
 * server imports here so this can be imported by client components too.
 */

export interface LandslideRecordDto {
  id: string
  lat: number
  lon: number
  tipo: string | null
  subtipo: string | null
}

export interface LandslideInventoryResponse {
  generatedAt: string
  records: LandslideRecordDto[]
}

export interface LandslideInventoryErrorResponse {
  error: string
}
