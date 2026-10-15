import type { AlertHazard, Sensitivity } from './types'

export interface ZoneChoice {
  municipioCode: string
  municipioName: string
  veredaCode: string | null
  veredaName: string | null
}

export const HAZARD_LABELS: Record<AlertHazard, string> = {
  deslizamientos: 'Deslizamientos',
  inundaciones: 'Inundaciones',
  incendios: 'Incendios forestales',
  sismos: 'Sismos',
}

export const HAZARD_HINTS: Record<AlertHazard, string> = {
  deslizamientos: 'Lluvia intensa o acumulada sobre laderas susceptibles',
  inundaciones: 'Crecidas de ríos y quebradas',
  incendios: 'Calor y sequedad extremos',
  sismos: 'Sismos fuertes cerca de su zona',
}

export const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string; description: string }[] = [
  {
    value: 'preventivas_y_emergencias',
    label: 'Preventivas y emergencias',
    description: 'Un aviso para prepararse y otro cuando hay que actuar. Recomendado.',
  },
  {
    value: 'solo_emergencias',
    label: 'Solo emergencias',
    description: 'Únicamente cuando hay que actuar. Menos mensajes.',
  },
]

export const MAX_VEREDAS = 5

export interface SubscriptionPayload {
  phone: string
  zones: ZoneChoice[]
  hazards: AlertHazard[]
  sensitivity: Sensitivity
}

export async function postAlertas<T extends { ok: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as T
  } catch {
    return { ok: false, error: 'Sin conexión. Intente de nuevo.' } as T
  }
}

export function toRequestZones(zones: ZoneChoice[]) {
  return zones.map((z) => ({ municipioCode: z.municipioCode, veredaCode: z.veredaCode }))
}
