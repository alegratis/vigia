import 'server-only'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const CHUNK_SIZE = 40
const REVALIDATE_SECONDS = 600

export interface RainForecast {
  next24hMm: number
  next48hMm: number
}

interface HourlyPayload {
  hourly?: { time?: string[]; precipitation?: Array<number | null> }
}

function summarize(payload: HourlyPayload): RainForecast | null {
  const times = payload.hourly?.time
  const values = payload.hourly?.precipitation
  if (!times || !values || times.length === 0) return null

  // Con timezone=GMT los tiempos llegan sin sufijo; el primero es 00:00 UTC de hoy.
  const firstMs = Date.parse(`${times[0]}Z`)
  const startIndex = Math.max(0, Math.floor((Date.now() - firstMs) / 3_600_000))

  const sum = (from: number, to: number) => {
    let total = 0
    let valid = 0
    for (let i = from; i < Math.min(to, values.length); i++) {
      const v = values[i]
      if (typeof v === 'number') {
        total += v
        valid++
      }
    }
    return valid > 0 ? total : null
  }

  const next24 = sum(startIndex, startIndex + 24)
  const next48 = sum(startIndex, startIndex + 48)
  if (next24 == null || next48 == null) return null
  return { next24hMm: next24, next48hMm: next48 }
}

/**
 * Lluvia pronosticada para las próximas 24 y 48 h, calculada desde el
 * pronóstico horario de Open-Meteo. El disparador histórico llega con ~1 día
 * de retraso; este pronóstico es lo que permite alertar a tiempo. Una sola
 * petición por lote de puntos; `null` para el punto que falle.
 */
export async function getRainForecastBatch(
  points: Array<{ lat: number; lon: number }>,
): Promise<Array<RainForecast | null>> {
  const results: Array<RainForecast | null> = new Array(points.length).fill(null)

  for (let offset = 0; offset < points.length; offset += CHUNK_SIZE) {
    const chunk = points.slice(offset, offset + CHUNK_SIZE)
    const params = new URLSearchParams({
      latitude: chunk.map((p) => p.lat.toFixed(2)).join(','),
      longitude: chunk.map((p) => p.lon.toFixed(2)).join(','),
      hourly: 'precipitation',
      timezone: 'GMT',
      forecast_days: '3',
    })

    try {
      const res = await fetch(`${FORECAST_URL}?${params.toString()}`, {
        next: { revalidate: REVALIDATE_SECONDS },
      })
      if (!res.ok) continue
      const body = (await res.json()) as HourlyPayload | HourlyPayload[]
      const payloads = Array.isArray(body) ? body : [body]
      payloads.forEach((payload, i) => {
        results[offset + i] = summarize(payload)
      })
    } catch {
      // El lote queda en null: el evaluador lo trata como dato desconocido y no alerta.
    }
  }

  return results
}
