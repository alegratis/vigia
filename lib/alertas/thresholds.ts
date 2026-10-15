/**
 * Umbrales iniciales del motor de alertas SMS. Son un punto de partida para
 * calibrar en modo sombra y con el backtest, no valores definitivos.
 *
 * Principio: regla de dos llaves. Hace falta susceptibilidad estática alta
 * Y un disparador dinámico activo. Una vereda de ladera con score alto no
 * debe alertar todos los días solo por su pendiente.
 */

/** Corte de susceptibilidad "alta" (escala 0.2 / 0.4 / 0.6 / 0.8 del proyecto). */
export const STATIC_SUSCEPTIBILITY_MIN = 0.6

export const LANDSLIDE = {
  prepararse: {
    /** Razón del disparador de lluvia contra la climatología. */
    triggerMin: 0.5,
    /**
     * Pisos absolutos: en época seca la climatología es casi cero y 10 mm ya
     * da una razón alta. Estos mm evitan esa falsa alarma.
     */
    observed7dMm: 75,
    forecast48hMm: 50,
  },
  actuar: {
    triggerMin: 0.8,
    observed7dMm: 150,
    forecast24hMm: 50,
  },
} as const

export const FLOOD = {
  prepararse: {
    /** Periodo de retorno que alcanza la mediana del pronóstico. */
    medianReturnPeriodYears: 5,
    withinHours: 72,
  },
  actuar: {
    medianReturnPeriodYears: 10,
    upperBandReturnPeriodYears: 25,
    withinHours: 48,
  },
} as const

export const FIRE = {
  prepararse: { fwiMin: 20, consecutiveDays: 2 },
  /** Clase Extrema de Van Wagner. */
  actuar: { fwiMin: 30 },
} as const

export const QUAKE = {
  prepararse: { magnitudeMin: 4.5, maxDistanceKm: 100 },
  actuar: { magnitudeMin: 5.5, maxDistanceKm: 150 },
  /** El mismo evento de SGC y USGS: ±60 s y ±0.5°. */
  dedupeSeconds: 60,
  dedupeDegrees: 0.5,
  /** Espera antes de enviar para que ambas redes reporten y se deduplique. */
  settleMinutes: 3,
} as const

export const CONTROLS = {
  evaluationIntervalMinutes: 15,
  /** Evaluaciones seguidas que deben cumplir el disparador (no aplica a sismos ni a Actuar de inundación). */
  persistenceEvaluations: 2,
  /** El indicador debe bajar a este factor del umbral para rearmar la vereda. */
  hysteresisFactor: 0.85,
  rearmAfterHours: 6,
  cooldownHours: 12,
  maxSmsPerSubscriberPer24h: 3,
  quietHours: { startHour: 22, endHour: 6 },
  /** Fuera de este margen un ciclo se considera atrasado y se avisa al administrador. */
  staleCycleMinutes: 45,
  maxVeredasPerSubscriber: 5,
  /** Zona horaria de Colombia para las horas de silencio. */
  timeZone: 'America/Bogota',
} as const
