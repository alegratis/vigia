/**
 * Presentation helpers for the flood section. Client-safe: no server imports.
 * Colors reference the chart design tokens (see globals.css) so both themes and
 * the hydrograph stay in sync.
 */

import type { FloodLevelKey } from "@/lib/geoglows/flood"

export interface LevelStyle {
  label: string
  /** CSS color for dots, lines and accents. */
  color: string
  /** Ordinal severity for sorting/comparison. */
  rank: number
}

/** Central mapping of severity level -> label, color token and rank. */
export const LEVEL_STYLES: Record<FloodLevelKey, LevelStyle> = {
  normal: { label: "Normal", color: "var(--chart-2)", rank: 0 },
  vigilancia: { label: "Vigilancia", color: "var(--chart-3)", rank: 1 },
  alerta: { label: "Alerta", color: "var(--chart-4)", rank: 2 },
  alerta_alta: { label: "Alerta alta", color: "var(--chart-4)", rank: 3 },
  emergencia: { label: "Emergencia", color: "var(--chart-5)", rank: 4 },
  extrema: { label: "Extrema", color: "var(--chart-5)", rank: 5 },
}

export function levelStyle(key: FloodLevelKey): LevelStyle {
  return LEVEL_STYLES[key] ?? LEVEL_STYLES.normal
}

const flowFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
})

/** Format a streamflow value in m³/s with Spanish locale. */
export function formatFlow(value: number): string {
  return `${flowFormatter.format(value)} m³/s`
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
})

/** Full date + time, e.g. "12 sept, 14:00". */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

/** Short date, e.g. "12 sept". */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

/** Human lead time in Spanish: "en 2 d 6 h" / "en 9 h". */
export function formatLeadTime(hours: number): string {
  if (hours <= 0) return "ahora"
  const days = Math.floor(hours / 24)
  const rem = hours % 24
  if (days > 0) {
    return rem > 0 ? `en ${days} d ${rem} h` : `en ${days} d`
  }
  return `en ${rem} h`
}
