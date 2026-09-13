import type { WeatherGroup } from "./api-types"

/**
 * Maps Open-Meteo's WMO `weather_code` (0-99) to one of this app's coarse
 * weather groups. Reference table:
 * https://open-meteo.com/en/docs#weathervariables — we collapse the drizzle,
 * rain and shower sub-severities into a few families that each read clearly
 * as a single glyph. Snow codes are mapped for completeness even though this
 * tropical study area never sees them.
 */
export function weatherGroupFromCode(code: number | null | undefined): WeatherGroup {
  if (code == null) return "nublado"
  if (code === 0 || code === 1) return "despejado"
  if (code === 2) return "parcial"
  if (code === 3) return "nublado"
  if (code === 45 || code === 48) return "niebla"
  if ([51, 53, 55, 56, 57].includes(code)) return "llovizna"
  if ([61, 63, 65, 66, 67, 80, 81].includes(code)) return "lluvia"
  if (code === 82) return "aguacero"
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "nieve"
  if ([95, 96, 99].includes(code)) return "tormenta"
  return "nublado"
}

export const WEATHER_GROUP_LABELS: Record<WeatherGroup, string> = {
  despejado: "Despejado",
  parcial: "Parcialmente nublado",
  nublado: "Nublado",
  niebla: "Niebla",
  llovizna: "Llovizna",
  lluvia: "Lluvia",
  aguacero: "Aguaceros",
  tormenta: "Tormenta eléctrica",
  nieve: "Nieve",
}
