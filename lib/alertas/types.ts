export type AlertHazard = 'deslizamientos' | 'inundaciones' | 'incendios' | 'sismos'

export const ALERT_HAZARDS: readonly AlertHazard[] = [
  'deslizamientos',
  'inundaciones',
  'incendios',
  'sismos',
]

/** Solo dos niveles generan SMS; "informar" se queda en la app. */
export type AlertTier = 'prepararse' | 'actuar'

export type AlertMode = 'off' | 'shadow' | 'live'

export type Sensitivity = 'solo_emergencias' | 'preventivas_y_emergencias'

export interface AlertEvaluation {
  hazard: AlertHazard
  /** null = sin alerta (por debajo de todos los umbrales). */
  tier: AlertTier | null
  /** Valores que dispararon (o casi dispararon) la regla; se guarda en alert_events. */
  evidence: Record<string, number | string | boolean | null>
}

export function tierRank(tier: AlertTier | null): number {
  if (tier === 'actuar') return 2
  if (tier === 'prepararse') return 1
  return 0
}
