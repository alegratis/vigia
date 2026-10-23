import 'server-only'
import { getAlertMode } from '@/lib/admin/settings'
import { computeRainfallTriggerBatch } from '@/lib/deslizamientos/rainfall-trigger'
import { computeVeredaHazard } from '@/lib/deslizamientos/hazard-model'
import { assessReach } from '@/lib/geoglows/service'
import { STATIONS } from '@/lib/geoglows/stations'
import { computeVeredaFireHazard } from '@/lib/incendios/hazard-model'
import { computeVeredaFloodHazard } from '@/lib/inundaciones/hazard-model'
import { getAccumulatedPrecipitationBatch } from '@/lib/precipitacion/openmeteo-accumulation-client'
import { getSismologiaEventos } from '@/lib/sismologia/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { dispatchPending } from './dispatch'
import { evaluateFire, evaluateFloodReach, evaluateLandslide, evaluateQuake } from './evaluate'
import { getRainForecastBatch } from './rain-hourly'
import { requiredHitsFor, stepState, type AlertStateRow } from './state'
import { CONTROLS, QUAKE, STATIC_SUSCEPTIBILITY_MIN } from './thresholds'
import { isTwilioConfigured } from './twilio'
import { tierRank, type AlertHazard, type AlertMode, type AlertTier } from './types'
import {
  loadMonitoring,
  municipioNameByCode,
  municipioScopeKey,
  type Monitoring,
  type VeredaUnit,
} from './zones'

type Evidence = Record<string, number | string | boolean | null>

interface Candidate {
  hazard: AlertHazard
  scopeKey: string
  municipioCode: string
  veredaCode: string | null
  tier: AlertTier | null
  evidence: Evidence
}

export interface RunSummary {
  status: 'ok' | 'skipped_off' | 'skipped_locked' | 'error'
  mode: AlertMode
  unitsEvaluated: number
  subscriptions: number
  candidates: number
  eventsCreated: number
  sends: number
  errors: string[]
}

const LOCK_MINUTES = 10
const SLOW_HAZARDS: AlertHazard[] = ['deslizamientos', 'inundaciones', 'incendios']

function maxTier(a: AlertTier | null, b: AlertTier | null): AlertTier | null {
  return tierRank(a) >= tierRank(b) ? a : b
}

function pointOf(u: VeredaUnit) {
  return { codigoVereda: u.veredaCode, lat: u.lat, lon: u.lon }
}

/** Resume un grupo de veredas en el candidato de su municipio: el nivel más alto entre ellas. */
function rollUpToMunicipio(
  hazard: AlertHazard,
  municipioCode: string,
  members: Candidate[],
): Candidate | null {
  if (members.length === 0) return null
  let tier: AlertTier | null = null
  let top: Candidate | null = null
  for (const m of members) {
    if (tierRank(m.tier) > tierRank(tier)) {
      tier = m.tier
      top = m
    }
  }
  return {
    hazard,
    scopeKey: municipioScopeKey(municipioCode),
    municipioCode,
    veredaCode: null,
    tier,
    evidence: {
      veredas_evaluadas: members.length,
      veredas_en_alerta: members.filter((m) => m.tier).length,
      vereda_mas_critica: top?.veredaCode ?? null,
      ...(top?.evidence ?? {}),
    },
  }
}

async function evaluateSlowHazards(
  monitoring: Monitoring,
  errors: string[],
): Promise<Candidate[]> {
  const { units } = monitoring
  if (units.length === 0) return []

  const candidates: Candidate[] = []
  const points = units.map(pointOf)
  const byMunicipio = (code: string) => units.filter((u) => u.municipioCode === code)

  // Deslizamientos (y la pendiente/vías que reutilizan incendios e inundaciones)
  const landslide = new Map<string, Candidate>()
  let hazardByCode: Awaited<ReturnType<typeof computeVeredaHazard>> | null = null
  try {
    const [hazard, triggers, observed, forecast] = await Promise.all([
      computeVeredaHazard(points),
      computeRainfallTriggerBatch(points, 12),
      getAccumulatedPrecipitationBatch(points, 7),
      getRainForecastBatch(points),
    ])
    hazardByCode = hazard
    units.forEach((u, i) => {
      const h = hazard.get(u.veredaCode)
      const obs = observed[i]
      const fc = forecast[i]
      // Sin susceptibilidad o sin ninguna señal de lluvia, el dato es desconocido: no se toca el estado.
      if (h?.staticScore == null) return
      if (obs == null && fc == null) return
      const result = evaluateLandslide({
        staticScore: h.staticScore,
        triggerScore: triggers[i]?.score ?? null,
        observed7dMm: obs?.accumulatedMm ?? null,
        forecast24hMm: fc?.next24hMm ?? null,
        forecast48hMm: fc?.next48hMm ?? null,
      })
      landslide.set(u.veredaCode, {
        hazard: 'deslizamientos',
        scopeKey: u.veredaCode,
        municipioCode: u.municipioCode,
        veredaCode: u.veredaCode,
        tier: result.tier,
        evidence: result.evidence,
      })
    })
  } catch (e) {
    errors.push(`deslizamientos: ${e instanceof Error ? e.message : String(e)}`)
  }
  candidates.push(...landslide.values())
  for (const code of monitoring.municipioScopes) {
    const rolled = rollUpToMunicipio(
      'deslizamientos',
      code,
      byMunicipio(code).flatMap((u) => landslide.get(u.veredaCode) ?? []),
    )
    if (rolled) candidates.push(rolled)
  }

  // Inundaciones: nivel del río por municipio (GEOGLOWS) x susceptibilidad estática de la vereda
  try {
    const municipioCodes = new Set(units.map((u) => u.municipioCode))
    const stationTier = new Map<string, { tier: AlertTier | null; evidence: Evidence }>()
    for (const code of municipioCodes) {
      const name = municipioNameByCode(code)
      const stations = STATIONS.filter((s) => s.municipality === name)
      const settled = await Promise.allSettled(stations.map((s) => assessReach(s.reachId)))
      let tier: AlertTier | null = null
      let evidence: Evidence = {}
      let ok = 0
      settled.forEach((r) => {
        if (r.status !== 'fulfilled') return
        ok++
        const verdict = evaluateFloodReach(r.value)
        if (tierRank(verdict.tier) > tierRank(tier) || ok === 1) {
          if (tierRank(verdict.tier) >= tierRank(tier)) evidence = verdict.evidence
        }
        tier = maxTier(tier, verdict.tier)
      })
      if (ok === 0) {
        errors.push(`inundaciones: sin pronostico GEOGLOWS para ${name}`)
        continue
      }
      stationTier.set(code, { tier, evidence })
    }

    const floodHazard = await computeVeredaFloodHazard(
      units.map((u) => ({
        ...pointOf(u),
        slopeDeg: hazardByCode?.get(u.veredaCode)?.slopeDeg ?? null,
      })),
    )
    const flood = new Map<string, Candidate>()
    for (const u of units) {
      const station = stationTier.get(u.municipioCode)
      const score = floodHazard.get(u.veredaCode)?.score
      if (!station || score == null) continue
      const susceptible = score >= STATIC_SUSCEPTIBILITY_MIN
      flood.set(u.veredaCode, {
        hazard: 'inundaciones',
        scopeKey: u.veredaCode,
        municipioCode: u.municipioCode,
        veredaCode: u.veredaCode,
        tier: susceptible ? station.tier : null,
        evidence: { ...station.evidence, static_score: score },
      })
    }
    candidates.push(...flood.values())
    for (const code of monitoring.municipioScopes) {
      const station = stationTier.get(code)
      if (!station) continue
      candidates.push({
        hazard: 'inundaciones',
        scopeKey: municipioScopeKey(code),
        municipioCode: code,
        veredaCode: null,
        tier: station.tier,
        evidence: station.evidence,
      })
    }
  } catch (e) {
    errors.push(`inundaciones: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Incendios
  const fire = new Map<string, Candidate>()
  try {
    const fireHazard = await computeVeredaFireHazard(
      units.map((u) => ({
        ...pointOf(u),
        slopeDeg: hazardByCode?.get(u.veredaCode)?.slopeDeg ?? null,
        roadDistanceKm: hazardByCode?.get(u.veredaCode)?.roadDistanceKm ?? null,
      })),
    )
    for (const u of units) {
      const f = fireHazard.get(u.veredaCode)
      if (f?.staticScore == null || f.fwi == null) continue
      const result = evaluateFire({ staticScore: f.staticScore, fwi: f.fwi })
      fire.set(u.veredaCode, {
        hazard: 'incendios',
        scopeKey: u.veredaCode,
        municipioCode: u.municipioCode,
        veredaCode: u.veredaCode,
        tier: result.tier,
        evidence: result.evidence,
      })
    }
  } catch (e) {
    errors.push(`incendios: ${e instanceof Error ? e.message : String(e)}`)
  }
  candidates.push(...fire.values())
  for (const code of monitoring.municipioScopes) {
    const rolled = rollUpToMunicipio(
      'incendios',
      code,
      byMunicipio(code).flatMap((u) => fire.get(u.veredaCode) ?? []),
    )
    if (rolled) candidates.push(rolled)
  }

  return candidates
}

interface EventRow {
  hazard: AlertHazard
  scope_key: string
  municipio_code: string
  vereda_code: string | null
  tier: AlertTier
  evidence: Evidence
  dedupe_key: string
  mode: 'shadow' | 'live'
}

async function evaluateQuakes(
  monitoring: Monitoring,
  mode: 'shadow' | 'live',
  now: Date,
  errors: string[],
): Promise<EventRow[]> {
  if (monitoring.municipioScopes.length === 0 && monitoring.veredaScopes.length === 0) return []

  let feed
  try {
    feed = await getSismologiaEventos()
  } catch (e) {
    errors.push(`sismos: ${e instanceof Error ? e.message : String(e)}`)
    return []
  }

  const oldest = now.getTime() - 3 * 3_600_000
  const settled = now.getTime() - QUAKE.settleMinutes * 60_000
  const events = [...feed.sgcLive.events, ...feed.sgc.events, ...feed.usgs.events].filter((ev) => {
    const t = Date.parse(ev.time)
    return t >= oldest && t <= settled
  })
  if (events.length === 0) return []

  const zones: Array<{ scopeKey: string; municipioCode: string; veredaCode: string | null; lat: number; lon: number }> = []
  for (const code of monitoring.municipioScopes) {
    const c = monitoring.municipioCentroids[code]
    if (c) zones.push({ scopeKey: municipioScopeKey(code), municipioCode: code, veredaCode: null, ...c })
  }
  for (const u of monitoring.units) {
    if (monitoring.veredaScopes.includes(u.veredaCode)) {
      zones.push({ scopeKey: u.veredaCode, municipioCode: u.municipioCode, veredaCode: u.veredaCode, lat: u.lat, lon: u.lon })
    }
  }

  const rows: EventRow[] = []
  for (const ev of events) {
    for (const zone of zones) {
      const verdict = evaluateQuake(ev, zone)
      if (!verdict.tier) continue
      rows.push({
        hazard: 'sismos',
        scope_key: zone.scopeKey,
        municipio_code: zone.municipioCode,
        vereda_code: zone.veredaCode,
        tier: verdict.tier,
        evidence: {
          event_id: ev.id,
          magnitude: ev.magnitude,
          depth_km: ev.depthKm,
          distance_km: Math.round(verdict.distanceKm),
          place: ev.place,
          time: ev.time,
          source: ev.source,
        },
        dedupe_key: `sismos:${ev.id}:${zone.scopeKey}:${verdict.tier}`,
        mode,
      })
    }
  }
  return rows
}

async function insertEvents(rows: EventRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const db = getSupabaseAdmin()
  // El dedupe_key único hace idempotente el ciclo: si se repite, no se duplica el evento.
  const { data, error } = await db
    .from('alert_events')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(`No se pudieron guardar los eventos: ${error.message}`)
  return data?.length ?? 0
}

async function applyStateMachine(
  candidates: Candidate[],
  mode: 'shadow' | 'live',
  now: Date,
): Promise<EventRow[]> {
  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('alert_state')
    .select('hazard, scope_key, tier, since, consecutive_hits, rearm_after, updated_at')
    .in('hazard', SLOW_HAZARDS)
  if (error) throw new Error(`No se pudo leer alert_state: ${error.message}`)

  const previous = new Map<string, AlertStateRow>()
  for (const row of (data ?? []) as AlertStateRow[]) previous.set(`${row.hazard}|${row.scope_key}`, row)

  const states: AlertStateRow[] = []
  const events: EventRow[] = []

  for (const c of candidates) {
    const key = `${c.hazard}|${c.scopeKey}`
    const step = stepState(c.hazard, c.scopeKey, previous.get(key) ?? null, c.tier, now, {
      requiredHits: requiredHitsFor(c.hazard),
      dailyStreak: c.hazard === 'incendios',
    })
    states.push(step.state)
    if (step.emit) {
      events.push({
        hazard: c.hazard,
        scope_key: c.scopeKey,
        municipio_code: c.municipioCode,
        vereda_code: c.veredaCode,
        tier: step.emit.tier,
        evidence: c.evidence,
        dedupe_key: `${c.hazard}:${c.scopeKey}:${step.emit.tier}:${step.emit.episode}`,
        mode,
      })
    }
  }

  if (states.length > 0) {
    const { error: upsertError } = await db.from('alert_state').upsert(states, { onConflict: 'hazard,scope_key' })
    if (upsertError) throw new Error(`No se pudo guardar alert_state: ${upsertError.message}`)
  }
  return events
}

/**
 * Un ciclo completo de evaluación. En esta etapa nunca envía SMS: guarda los
 * eventos (modo sombra) para calibrar los umbrales antes de gastar un mensaje.
 * Una fuente que falla no cambia el estado de sus zonas (falla cerrada).
 */
export async function runEvaluation(): Promise<RunSummary> {
  const requested = await getAlertMode()
  const summary: RunSummary = {
    status: 'ok',
    mode: requested,
    unitsEvaluated: 0,
    subscriptions: 0,
    candidates: 0,
    eventsCreated: 0,
    sends: 0,
    errors: [],
  }
  if (requested === 'off') return { ...summary, status: 'skipped_off' }

  const db = getSupabaseAdmin()
  const now = new Date()

  const { data: active } = await db
    .from('alert_runs')
    .select('id')
    .gt('locked_until', now.toISOString())
    .limit(1)
  if (active && active.length > 0) return { ...summary, status: 'skipped_locked' }

  const { data: run, error: runError } = await db
    .from('alert_runs')
    .insert({
      mode: requested,
      locked_until: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString(),
    })
    .select('id')
    .single()
  if (runError || !run) return { ...summary, status: 'error', errors: [runError?.message ?? 'sin ciclo'] }

  // Sin credenciales de Twilio, "live" se degrada a sombra: se registra pero no se envía.
  const canSend = requested === 'live' && isTwilioConfigured()
  const eventMode: 'shadow' | 'live' = canSend ? 'live' : 'shadow'
  if (requested === 'live' && !canSend) {
    summary.errors.push('El modo en vivo está activo pero faltan variables de Twilio: se registra en modo sombra, sin enviar')
  }

  try {
    const monitoring = await loadMonitoring()
    summary.unitsEvaluated = monitoring.units.length
    summary.subscriptions = monitoring.subscriptions

    const candidates = await evaluateSlowHazards(monitoring, summary.errors)
    summary.candidates = candidates.length

    const slowEvents = await applyStateMachine(candidates, eventMode, now)
    const quakeEvents = await evaluateQuakes(monitoring, eventMode, now, summary.errors)
    summary.eventsCreated = await insertEvents([...slowEvents, ...quakeEvents])
    if (canSend) {
      const dispatched = await dispatchPending(now, summary.errors)
      summary.sends = dispatched.sends
    }
  } catch (e) {
    summary.status = 'error'
    summary.errors.push(e instanceof Error ? e.message : String(e))
  }

  await db
    .from('alert_runs')
    .update({
      finished_at: new Date().toISOString(),
      locked_until: new Date().toISOString(),
      hazards_evaluated: SLOW_HAZARDS.concat('sismos'),
      events_created: summary.eventsCreated,
      sends: summary.sends,
      errors: summary.errors,
    })
    .eq('id', run.id)

  void CONTROLS
  return summary
}
