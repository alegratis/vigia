/** Presentation helpers for the demographics section. Client-safe. */

const intFormatter = new Intl.NumberFormat("es-CO")

/** Format an integer with Spanish thousands separators, e.g. "31.331". */
export function formatNumber(n: number): string {
  return intFormatter.format(n)
}

/** Share of `part` over `total` as a rounded percentage string. */
export function formatShare(part: number, total: number): string {
  if (total <= 0) return "0%"
  return `${Math.round((part / total) * 100)}%`
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}
