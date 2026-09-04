/**
 * Low-level client for the GEOGLOWS v2 REST API.
 * Docs: https://geoglows.ecmwf.int/api/v2/  (base) — all products return
 * column-oriented JSON: parallel arrays keyed by variable name.
 *
 * All responses are cached on the server via Next's fetch data cache. The
 * forecast refreshes roughly daily; the retrospective record is effectively
 * static, so it is cached far more aggressively.
 */

const API_BASE = "https://geoglows.ecmwf.int/api/v2"

const REVALIDATE = {
  /** getriverid: coordinate -> reach mapping never changes. */
  riverId: 60 * 60 * 24 * 30,
  /** forecast products: regenerated ~once per day. */
  forecast: 60 * 60,
  /** retrospective daily record: static history, refreshed occasionally. */
  retrospective: 60 * 60 * 24 * 7,
} as const

/** Streamflow units as reported by the API (cubic meters per second). */
export interface GeoglowsUnits {
  long: string
  name: string
  short: string
}

export interface ForecastMetadata {
  river_id: number
  gen_date: string
  start_date: string
  end_date: string
  units: GeoglowsUnits
}

/** `forecast/<id>` — deterministic median plus an uncertainty band. */
export interface ForecastResponse {
  datetime: string[]
  flow_median: number[]
  flow_uncertainty_lower: number[]
  flow_uncertainty_upper: number[]
  metadata: ForecastMetadata
}

/** `forecaststats/<id>` — ensemble percentile envelope + high-res member. */
export interface ForecastStatsResponse {
  datetime: string[]
  flow_min: number[]
  flow_25p: number[]
  flow_avg: number[]
  flow_med: number[]
  flow_75p: number[]
  flow_max: number[]
  high_res: number[]
  metadata: ForecastMetadata
}

/** Normalized daily retrospective series (raw payload keys the values by reach id). */
export interface RetrospectiveDaily {
  reachId: number
  datetime: string[]
  flow: number[]
  units: GeoglowsUnits
}

export class GeoglowsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "GeoglowsError"
  }
}

async function fetchJson<T>(
  path: string,
  revalidate: number,
  timeoutMs = 60_000,
): Promise<T> {
  const url = `${API_BASE}/${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      next: { revalidate },
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError"
    throw new GeoglowsError(
      aborted
        ? `GEOGLOWS request timed out after ${timeoutMs}ms: ${path}`
        : `GEOGLOWS request failed: ${path}`,
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    throw new GeoglowsError(`GEOGLOWS responded ${res.status} for ${path}`, res.status)
  }

  const data = (await res.json()) as T & { error?: string }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new GeoglowsError(`GEOGLOWS product error for ${path}: ${data.error}`)
  }
  return data
}

/** Resolve the nearest river reach id for a coordinate. */
export async function getRiverId(lat: number, lon: number): Promise<number> {
  const data = await fetchJson<{ river_id: number }>(
    `getriverid?lat=${lat}&lon=${lon}`,
    REVALIDATE.riverId,
    30_000,
  )
  return data.river_id
}

export function getForecast(reachId: number): Promise<ForecastResponse> {
  return fetchJson<ForecastResponse>(`forecast/${reachId}?format=json`, REVALIDATE.forecast)
}

export function getForecastStats(reachId: number): Promise<ForecastStatsResponse> {
  return fetchJson<ForecastStatsResponse>(
    `forecaststats/${reachId}?format=json`,
    REVALIDATE.forecast,
  )
}

/** Fetch and normalize the daily retrospective record (values keyed by reach id in the raw payload). */
export async function getRetrospectiveDaily(reachId: number): Promise<RetrospectiveDaily> {
  const raw = await fetchJson<Record<string, unknown>>(
    `retrospectivedaily/${reachId}?format=json`,
    REVALIDATE.retrospective,
    120_000,
  )

  const datetime = raw.datetime as string[] | undefined
  const flow = raw[String(reachId)] as number[] | undefined
  const metadata = raw.metadata as { units?: GeoglowsUnits } | undefined

  if (!datetime || !flow) {
    throw new GeoglowsError(`Malformed retrospective payload for reach ${reachId}`)
  }

  return {
    reachId,
    datetime,
    flow,
    units: metadata?.units ?? { long: "cubic meters per second", name: "streamflow", short: "cms" },
  }
}
