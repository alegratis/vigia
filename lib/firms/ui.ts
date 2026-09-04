/**
 * Presentation helpers for the fire section. Client-safe: no server imports.
 * Colors reference the chart design tokens so both themes stay in sync.
 */

import type { FireDetection } from "./api-types"

export type Confidence = FireDetection["confidence"]

export interface ConfidenceStyle {
  label: string
  color: string
}

export const CONFIDENCE_STYLES: Record<Confidence, ConfidenceStyle> = {
  high: { label: "Alta", color: "var(--chart-5)" },
  nominal: { label: "Nominal", color: "var(--chart-4)" },
  low: { label: "Baja", color: "var(--chart-3)" },
  unknown: { label: "Sin dato", color: "var(--muted-foreground)" },
}

export function confidenceStyle(key: Confidence): ConfidenceStyle {
  return CONFIDENCE_STYLES[key] ?? CONFIDENCE_STYLES.unknown
}

const frpFormatter = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 1,
})

/** Format Fire Radiative Power in megawatts. */
export function formatFrp(value: number): string {
  return `${frpFormatter.format(value)} MW`
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${frpFormatter.format(km)} km`
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/** Full date + time in local Colombia time, e.g. "12 sept, 14:00". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return dateTimeFormatter.format(d)
}
