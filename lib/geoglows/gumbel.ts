/**
 * Flood-frequency analysis via the Gumbel (Extreme Value Type I) distribution
 * fitted to the annual maximum daily streamflow series. This mirrors the
 * methodology GEOGLOWS uses to publish return-period thresholds, and it lets
 * us derive thresholds locally rather than depending on the `returnperiods`
 * REST product (which is currently broken server-side).
 *
 * Gumbel CDF:  F(x) = exp(-exp(-(x - mu) / beta))
 * Method of moments:  beta = std * sqrt(6) / pi,  mu = mean - gamma * beta
 * Return-period quantile:  x_T = mu - beta * ln(-ln(1 - 1/T))
 */

const EULER_MASCHERONI = 0.5772156649015329

/** Return periods (years) reported by the flood system, matching GEOGLOWS. */
export const RETURN_PERIODS = [2, 5, 10, 25, 50, 100] as const
export type ReturnPeriodYears = (typeof RETURN_PERIODS)[number]

export interface GumbelFit {
  mu: number
  beta: number
  mean: number
  std: number
  /** Number of complete years contributing an annual maximum. */
  years: number
}

/** Flow threshold (m³/s) for each return period, plus the fit used to derive them. */
export interface ReturnPeriodThresholds {
  fit: GumbelFit
  /** Map of return period (years) -> flow threshold in m³/s. */
  thresholds: Record<ReturnPeriodYears, number>
}

/**
 * Reduce a daily series to one maximum value per calendar year.
 * Years with no valid samples are dropped.
 */
export function annualMaxima(datetime: string[], flow: number[]): number[] {
  const maxByYear = new Map<number, number>()

  for (let i = 0; i < datetime.length; i++) {
    const value = flow[i]
    if (value == null || !Number.isFinite(value)) continue
    const year = Number(datetime[i].slice(0, 4))
    if (!Number.isFinite(year)) continue
    const current = maxByYear.get(year)
    if (current === undefined || value > current) {
      maxByYear.set(year, value)
    }
  }

  return [...maxByYear.values()]
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Sample standard deviation (n-1 denominator). */
function sampleStd(values: number[], avg: number): number {
  if (values.length < 2) return 0
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Fit Gumbel parameters to a set of annual maxima using method of moments. */
export function fitGumbel(annualMax: number[]): GumbelFit {
  const avg = mean(annualMax)
  const std = sampleStd(annualMax, avg)
  const beta = (std * Math.sqrt(6)) / Math.PI
  const mu = avg - EULER_MASCHERONI * beta
  return { mu, beta, mean: avg, std, years: annualMax.length }
}

/** Flow (m³/s) expected to be exceeded on average once every `years`. */
export function returnPeriodFlow(fit: GumbelFit, years: number): number {
  const p = 1 - 1 / years
  const flow = fit.mu - fit.beta * Math.log(-Math.log(p))
  return Math.max(0, flow)
}

/**
 * Compute return-period flow thresholds from a daily retrospective record.
 * Throws if fewer than 10 annual maxima are available (fit would be unreliable).
 */
export function computeReturnPeriods(
  datetime: string[],
  flow: number[],
): ReturnPeriodThresholds {
  const maxima = annualMaxima(datetime, flow)
  if (maxima.length < 10) {
    throw new Error(
      `Insufficient history for return-period analysis: only ${maxima.length} annual maxima`,
    )
  }

  const fit = fitGumbel(maxima)
  const thresholds = {} as Record<ReturnPeriodYears, number>
  for (const years of RETURN_PERIODS) {
    thresholds[years] = Number(returnPeriodFlow(fit, years).toFixed(2))
  }

  return { fit, thresholds }
}
