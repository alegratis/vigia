import { CONTROLS } from './thresholds'
import { tierRank, type AlertHazard, type AlertTier } from './types'

/**
 * Máquina de estados pura de cada (amenaza, zona): persistencia, rearme
 * (histéresis) y emisión de eventos solo cuando el nivel sube. No toca la base
 * de datos, así que se puede probar y reutilizar en el backtest.
 */

export interface AlertStateRow {
  hazard: AlertHazard
  scope_key: string
  /** Nivel por el que ya se alertó en el episodio actual; null = zona rearmada. */
  tier: AlertTier | null
  /** Inicio del episodio actual. */
  since: string | null
  consecutive_hits: number
  rearm_after: string | null
  /** Solo se actualiza cuando cambia el contador; en incendios marca el último día contado. */
  updated_at: string
}

export interface StepOptions {
  /** Evaluaciones seguidas que debe cumplir el candidato para cada nivel. */
  requiredHits: (tier: AlertTier) => number
  /** Cuenta como máximo una vez por día calendario (incendios: el FWI es diario). */
  dailyStreak?: boolean
}

export interface StepResult {
  state: AlertStateRow
  /** Se informa solo cuando el nivel sube respecto al ya alertado. */
  emit: { tier: AlertTier; episode: string } | null
}

/** Colombia no tiene horario de verano: UTC-5 fijo. */
function bogotaDayNumber(d: Date): number {
  return Math.floor((d.getTime() - 5 * 3_600_000) / 86_400_000)
}

export function stepState(
  hazard: AlertHazard,
  scopeKey: string,
  prev: AlertStateRow | null,
  candidate: AlertTier | null,
  now: Date,
  options: StepOptions,
): StepResult {
  const prevHits = prev?.consecutive_hits ?? 0
  let hits = prevHits
  let updatedAt = prev ? new Date(prev.updated_at) : now

  if (candidate) {
    if (options.dailyStreak) {
      if (prevHits === 0) {
        hits = 1
        updatedAt = now
      } else {
        const dayGap = bogotaDayNumber(now) - bogotaDayNumber(updatedAt)
        if (dayGap === 1) {
          hits = prevHits + 1
          updatedAt = now
        } else if (dayGap > 1) {
          hits = 1
          updatedAt = now
        }
      }
    } else {
      hits = prevHits + 1
      updatedAt = now
    }
  } else {
    hits = 0
    updatedAt = now
  }

  let effective: AlertTier | null = null
  if (candidate === 'actuar' && hits >= options.requiredHits('actuar')) effective = 'actuar'
  else if (candidate && hits >= options.requiredHits('prepararse')) effective = 'prepararse'

  const prevTier = prev?.tier ?? null
  let tier = prevTier
  let since = prev?.since ?? null
  let rearmAfter = prev?.rearm_after ?? null
  let emit: StepResult['emit'] = null

  if (effective) {
    rearmAfter = null
    if (tierRank(effective) > tierRank(prevTier)) {
      if (!prevTier) since = now.toISOString()
      tier = effective
      emit = { tier: effective, episode: since ?? now.toISOString() }
    }
  } else if (prevTier) {
    if (!candidate) {
      // El indicador bajó del umbral: la zona solo se rearma tras un periodo
      // tranquilo continuo, para que una lluvia que oscila no repita avisos.
      if (!rearmAfter) {
        rearmAfter = new Date(now.getTime() + CONTROLS.rearmAfterHours * 3_600_000).toISOString()
      } else if (now.getTime() >= Date.parse(rearmAfter)) {
        tier = null
        since = null
        rearmAfter = null
      }
    } else {
      rearmAfter = null
    }
  }

  return {
    state: {
      hazard,
      scope_key: scopeKey,
      tier,
      since,
      consecutive_hits: hits,
      rearm_after: rearmAfter,
      updated_at: updatedAt.toISOString(),
    },
    emit,
  }
}

export function requiredHitsFor(hazard: AlertHazard): StepOptions['requiredHits'] {
  const n = CONTROLS.persistenceEvaluations
  if (hazard === 'inundaciones') return (tier) => (tier === 'actuar' ? 1 : n)
  return () => n
}
