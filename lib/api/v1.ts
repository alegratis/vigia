import "server-only"
import { NextResponse } from "next/server"
import { getDegradedSources } from "@/lib/upstream/resilient"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
}

export const API_ATTRIBUTION =
  "Vigía (RED LabOT). Datos derivados de IDEAM, SGC, USGS, Open-Meteo, DANE y otras fuentes abiertas; consulte /documentacion para la metodología."

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

interface OkOptions {
  /** Segundos que el CDN puede servir la respuesta sin recalcularla. */
  cacheSeconds: number
  meta?: Record<string, unknown>
}

/** Una respuesta incompleta no debe quedar fijada en el CDN durante horas. */
const DEGRADED_CACHE_SECONDS = 60

export function ok<T>(data: T, { cacheSeconds, meta }: OkOptions) {
  // La API v1 se apoya solo en los límites de veredas; el resto de fuentes degradadas no la afecta.
  const degraded = getDegradedSources(["veredas:"]).map((s) => ({ fuente: s.key, estado: s.state }))
  const effectiveCache = degraded.length > 0 ? Math.min(cacheSeconds, DEGRADED_CACHE_SECONDS) : cacheSeconds

  return NextResponse.json(
    {
      data,
      meta: {
        generadoEn: new Date().toISOString(),
        atribucion: API_ATTRIBUTION,
        ...(degraded.length > 0 ? { fuentesDegradadas: degraded } : {}),
        ...meta,
      },
    },
    {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": `public, s-maxage=${effectiveCache}, stale-while-revalidate=${effectiveCache * 5}`,
      },
    },
  )
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  )
}

/** Lee un entero de la query string acotado a [min, max]; devuelve `null` si el valor no es un entero válido. */
export function readInt(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null || value === "") return fallback
  if (!/^-?\d+$/.test(value)) return null
  const n = Number(value)
  return n < min || n > max ? null : n
}

export function readFloat(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null || value === "") return fallback
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

/** Minúsculas y sin tildes, para comparar nombres de municipio sin depender de cómo los escriba el cliente. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}
