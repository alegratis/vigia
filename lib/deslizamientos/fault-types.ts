/**
 * Client-safe types for /api/deslizamientos/fallas — the SGC geological
 * faults layer (see lib/deslizamientos/faults.ts for the server fetcher
 * and the hazard-model factor that also reuses it). No server imports
 * here so this can be imported by client components too.
 */

export interface FaultTraceDto {
  id: string
  tipo: string | null
  nombre: string | null
  paths: Array<Array<[number, number]>>
}

export interface FaultsResponse {
  generatedAt: string
  traces: FaultTraceDto[]
}

export interface FaultsErrorResponse {
  error: string
}
