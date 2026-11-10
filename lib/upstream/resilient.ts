import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type SourceState = 'live' | 'stale' | 'down'

export interface SourceStatus {
  key: string
  state: SourceState
  error: string | null
  checkedAt: string
}

export interface SnapshotOptions<T> {
  /** Cuánto tiempo se reutiliza el valor en memoria sin volver a pedirlo. */
  ttlSeconds?: number
  /** Tope de espera de la fuente externa. */
  timeoutMs?: number
  /** Valor a devolver si la fuente falla y no hay ninguna versión guardada. Sin él, se relanza el error. */
  fallback?: T
}

const DEFAULT_TTL_SECONDS = 900
const DEFAULT_TIMEOUT_MS = 30_000
/** Tras un fallo no se vuelve a llamar a la fuente durante este tiempo: evita que cada petición espere el timeout completo. */
const RETRY_AFTER_FAILURE_MS = 60_000
const PERSIST_EVERY_MS = 6 * 3_600_000
const MAX_PERSIST_BYTES = 12_000_000

interface MemoryEntry {
  value: unknown
  at: number
}

const memory = new Map<string, MemoryEntry>()
const failedUntil = new Map<string, number>()
const lastPersisted = new Map<string, number>()
const statuses = new Map<string, SourceStatus>()
const inflight = new Map<string, Promise<unknown>>()

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : ''
  return `${message}${cause}`.slice(0, 300)
}

async function withTimeout<T>(promise: Promise<T>, ms: number, key: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${key}: la fuente no respondió en ${Math.round(ms / 1000)} s`)), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Ejecuta trabajo de segundo plano sin bloquear la respuesta, y sin romper fuera de una petición. */
function background(task: () => Promise<void>): void {
  const safe = () => task().catch((error) => console.error('[upstream] segundo plano:', describe(error)))
  void import('next/server')
    .then(({ after }) => {
      try {
        after(safe)
      } catch {
        void safe()
      }
    })
    .catch(() => void safe())
}

function record(key: string, state: SourceState, error: string | null): void {
  const previous = statuses.get(key)
  const checkedAt = new Date().toISOString()
  statuses.set(key, { key, state, error, checkedAt })
  if (previous?.state === state && previous.error === error && state === 'live') return

  background(async () => {
    await getSupabaseAdmin()
      .from('upstream_snapshots')
      .upsert({ key, last_status: state, last_error: error, last_checked_at: checkedAt }, { onConflict: 'key' })
  })
}

function persist(key: string, value: unknown): void {
  const now = Date.now()
  if (now - (lastPersisted.get(key) ?? 0) < PERSIST_EVERY_MS) return
  lastPersisted.set(key, now)

  background(async () => {
    const size = Buffer.byteLength(JSON.stringify(value))
    if (size > MAX_PERSIST_BYTES) {
      console.error(`[upstream] ${key}: ${size} bytes superan el máximo guardable, no se persiste`)
      return
    }
    const { error } = await getSupabaseAdmin().from('upstream_snapshots').upsert(
      {
        key,
        payload: value,
        fetched_at: new Date(now).toISOString(),
        size_bytes: size,
        last_status: 'live',
        last_error: null,
        last_checked_at: new Date(now).toISOString(),
      },
      { onConflict: 'key' },
    )
    if (error) {
      lastPersisted.delete(key)
      throw new Error(error.message)
    }
  })
}

async function readSnapshot<T>(key: string): Promise<T | null> {
  try {
    const { data } = await getSupabaseAdmin().from('upstream_snapshots').select('payload').eq('key', key).maybeSingle()
    return (data?.payload ?? null) as T | null
  } catch {
    return null
  }
}

async function serveFallback<T>(key: string, options: SnapshotOptions<T>, error: unknown): Promise<T> {
  const message = describe(error)
  failedUntil.set(key, Date.now() + RETRY_AFTER_FAILURE_MS)

  const inMemory = memory.get(key)
  if (inMemory) {
    record(key, 'stale', message)
    return inMemory.value as T
  }

  const stored = await readSnapshot<T>(key)
  if (stored !== null) {
    memory.set(key, { value: stored, at: 0 })
    record(key, 'stale', message)
    return stored
  }

  record(key, 'down', message)
  if ('fallback' in options) return options.fallback as T
  throw new Error(`La fuente externa "${key}" no responde y todavía no hay una copia guardada (${message})`, { cause: error })
}

async function resolveSource<T>(key: string, load: () => Promise<T>, options: SnapshotOptions<T>): Promise<T> {
  if ((failedUntil.get(key) ?? 0) > Date.now()) {
    return serveFallback(key, options, new Error(statuses.get(key)?.error ?? `${key}: fuente en pausa tras un fallo reciente`))
  }

  try {
    const value = await withTimeout(load(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS, key)
    memory.set(key, { value, at: Date.now() })
    failedUntil.delete(key)
    record(key, 'live', null)
    persist(key, value)
    return value
  } catch (error) {
    return serveFallback(key, options, error)
  }
}

/**
 * Envuelve una fuente externa para que su caída no tumbe la API.
 *
 * Éxito: guarda el valor en memoria y, como mucho cada 6 h, una copia en Supabase.
 * Fallo: sirve la última versión buena (memoria, luego Supabase). Si no existe
 * ninguna, devuelve `fallback` cuando se indicó, o relanza el error.
 * Las llamadas simultáneas a la misma clave comparten una única petición.
 */
export async function withSnapshot<T>(key: string, load: () => Promise<T>, options: SnapshotOptions<T> = {}): Promise<T> {
  const cached = memory.get(key)
  if (cached && Date.now() - cached.at < (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000) {
    return cached.value as T
  }

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const run = resolveSource(key, load, options).finally(() => inflight.delete(key))
  inflight.set(key, run)
  return run
}

/**
 * Fuentes que en esta instancia están sirviendo datos viejos o ninguno.
 * `prefixes` limita el resultado a las familias de claves que le importan a quien pregunta
 * (por ejemplo "veredas:"), para no declarar degradada una respuesta por una fuente ajena.
 */
export function getDegradedSources(prefixes?: string[]): SourceStatus[] {
  return [...statuses.values()].filter(
    (s) => s.state !== 'live' && (!prefixes || prefixes.some((prefix) => s.key.startsWith(prefix))),
  )
}

export function getSourceStatus(key: string): SourceStatus | null {
  return statuses.get(key) ?? null
}

export interface StoredSourceStatus {
  key: string
  state: SourceState | 'unknown'
  error: string | null
  checkedAt: string
  snapshotAt: string | null
  snapshotBytes: number | null
}

/** Estado persistido de todas las fuentes, compartido entre instancias. */
export async function readStoredStatuses(): Promise<StoredSourceStatus[]> {
  const { data } = await getSupabaseAdmin()
    .from('upstream_snapshots')
    .select('key, last_status, last_error, last_checked_at, fetched_at, size_bytes')
    .order('key')
  return (data ?? []).map((row) => ({
    key: row.key as string,
    state: row.last_status as StoredSourceStatus['state'],
    error: (row.last_error as string | null) ?? null,
    checkedAt: row.last_checked_at as string,
    snapshotAt: (row.fetched_at as string | null) ?? null,
    snapshotBytes: (row.size_bytes as number | null) ?? null,
  }))
}
