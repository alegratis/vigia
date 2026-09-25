/**
 * Shared month-label constant for precipitación climatology charts. Used
 * to still live alongside a client for IDEAM's public monthly
 * precipitation *climatology* raster (visualizador.ideam.gov.co) — that
 * service has been unreliable/down, so the decadal and quinquenal
 * histograms above the precipitación map now compute their own monthly
 * averages directly from Open-Meteo's historical archive instead (see
 * openmeteo-decadal-climatology.ts and openmeteo-quinquenal-climatology.ts).
 * This constant is kept because both of those modules still import it.
 */
export const MONTH_LABELS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const
