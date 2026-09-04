/**
 * Flood severity classification and forecast analysis.
 *
 * Severity is assigned by the highest return-period threshold a given flow
 * exceeds. Labels/levels follow Colombian (IDEAM) alert conventions in
 * Spanish, with a color token that maps to the app's chart palette.
 */

import type { ForecastResponse } from "./client"
import type { ReturnPeriodThresholds, ReturnPeriodYears } from "./gumbel"
import { RETURN_PERIODS } from "./gumbel"

export type FloodLevelKey =
  | "normal"
  | "vigilancia"
  | "alerta"
  | "alerta_alta"
  | "emergencia"
  | "extrema"

export interface FloodLevel {
  key: FloodLevelKey
  /** Spanish label for UI display. */
  label: string
  /** Return period (years) whose threshold defines this level, or null for normal. */
  returnPeriod: ReturnPeriodYears | null
  /** Design token name (see globals.css chart tokens). */
  colorToken: string
}

/** Ordered ascending by severity. Each level is triggered at its return period. */
const FLOOD_LEVELS: FloodLevel[] = [
  { key: "normal", label: "Normal", returnPeriod: null, colorToken: "chart-2" },
  { key: "vigilancia", label: "Vigilancia", returnPeriod: 2, colorToken: "chart-3" },
  { key: "alerta", label: "Alerta", returnPeriod: 5, colorToken: "chart-4" },
  { key: "alerta_alta", label: "Alerta alta", returnPeriod: 10, colorToken: "chart-4" },
  { key: "emergencia", label: "Emergencia", returnPeriod: 25, colorToken: "chart-5" },
  { key: "extrema", label: "Extrema", returnPeriod: 50, colorToken: "chart-5" },
]

/** Classify a single flow value against return-period thresholds. */
export function classifyFlow(
  flow: number,
  thresholds: Record<ReturnPeriodYears, number>,
): FloodLevel {
  let level = FLOOD_LEVELS[0]
  for (const candidate of FLOOD_LEVELS) {
    if (candidate.returnPeriod === null) continue
    if (flow >= thresholds[candidate.returnPeriod]) {
      level = candidate
    }
  }
  return level
}

export interface FloodPoint {
  datetime: string
  median: number
  lower: number
  upper: number
  level: FloodLevelKey
}

export interface ExceedanceInfo {
  /** First datetime the series reaches or exceeds the 2-year (vigilancia) threshold. */
  datetime: string
  /** Lead time in hours from the forecast start to that exceedance. */
  leadTimeHours: number
  level: FloodLevelKey
}

export interface FloodAssessment {
  reachId: number
  generatedAt: string
  units: string
  /** Return-period thresholds (m³/s) used for classification. */
  thresholds: Record<ReturnPeriodYears, number>
  returnPeriods: readonly number[]
  /** Flow at the first forecast step, treated as the current condition. */
  current: { datetime: string; flow: number; level: FloodLevel }
  /** Highest median flow over the forecast horizon and when it occurs. */
  peak: { datetime: string; flow: number; level: FloodLevel }
  /** Worst-case peak using the upper uncertainty bound. */
  peakUpper: { datetime: string; flow: number; level: FloodLevel }
  /** First threshold crossing on the median trace, if any. */
  medianExceedance: ExceedanceInfo | null
  /** First threshold crossing on the upper-bound trace, if any. */
  upperExceedance: ExceedanceInfo | null
  /** Per-step classified forecast series for charting. */
  series: FloodPoint[]
}

function levelFor(
  flow: number,
  thresholds: Record<ReturnPeriodYears, number>,
): FloodLevelKey {
  return classifyFlow(flow, thresholds).key
}

function hoursBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  return Math.round(ms / 36e5)
}

const VIGILANCIA_RP: ReturnPeriodYears = 2

function firstExceedance(
  datetime: string[],
  values: number[],
  thresholds: Record<ReturnPeriodYears, number>,
  startIso: string,
): ExceedanceInfo | null {
  const trigger = thresholds[VIGILANCIA_RP]
  for (let i = 0; i < values.length; i++) {
    if (values[i] >= trigger) {
      return {
        datetime: datetime[i],
        leadTimeHours: hoursBetween(startIso, datetime[i]),
        level: levelFor(values[i], thresholds),
      }
    }
  }
  return null
}

/** Build a full flood assessment from a forecast and precomputed thresholds. */
export function assessFlood(
  reachId: number,
  forecast: ForecastResponse,
  rp: ReturnPeriodThresholds,
): FloodAssessment {
  const { datetime, flow_median, flow_uncertainty_lower, flow_uncertainty_upper, metadata } =
    forecast
  const thresholds = rp.thresholds
  const startIso = datetime[0]

  const series: FloodPoint[] = datetime.map((dt, i) => ({
    datetime: dt,
    median: flow_median[i],
    lower: flow_uncertainty_lower[i],
    upper: flow_uncertainty_upper[i],
    level: levelFor(flow_median[i], thresholds),
  }))

  let peakIdx = 0
  let peakUpperIdx = 0
  for (let i = 1; i < flow_median.length; i++) {
    if (flow_median[i] > flow_median[peakIdx]) peakIdx = i
    if (flow_uncertainty_upper[i] > flow_uncertainty_upper[peakUpperIdx]) peakUpperIdx = i
  }

  return {
    reachId,
    generatedAt: metadata.gen_date,
    units: metadata.units.short,
    thresholds,
    returnPeriods: RETURN_PERIODS,
    current: {
      datetime: startIso,
      flow: flow_median[0],
      level: classifyFlow(flow_median[0], thresholds),
    },
    peak: {
      datetime: datetime[peakIdx],
      flow: flow_median[peakIdx],
      level: classifyFlow(flow_median[peakIdx], thresholds),
    },
    peakUpper: {
      datetime: datetime[peakUpperIdx],
      flow: flow_uncertainty_upper[peakUpperIdx],
      level: classifyFlow(flow_uncertainty_upper[peakUpperIdx], thresholds),
    },
    medianExceedance: firstExceedance(datetime, flow_median, thresholds, startIso),
    upperExceedance: firstExceedance(datetime, flow_uncertainty_upper, thresholds, startIso),
    series,
  }
}
