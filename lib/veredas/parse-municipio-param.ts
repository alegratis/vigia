import "server-only"

/**
 * Parses the `?municipio=` query param (a comma-separated list of DIVIPOLA
 * codes) into a validated code array. Every code must be exactly 5 digits,
 * both to reject malformed input and — since these codes are interpolated
 * into an ArcGIS `where` clause downstream — to prevent SQL/where injection.
 * Returns undefined when the param is absent or has no valid codes, so the
 * caller falls back to the default study area.
 */
export function parseMunicipioCodes(raw: string | null): string[] | undefined {
  if (!raw) return undefined
  const codes = raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^\d{5}$/.test(c))
  return codes.length > 0 ? codes : undefined
}
