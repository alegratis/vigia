import { getMunicipioByCode, DEFAULT_MUNICIPIO_CODE } from "./registry"

/**
 * Resolves the app's "active region" from a selected municipio code. This is
 * the single anchor every map, panel and the vereda backbone read from.
 *
 * The region is always exactly one municipio. With no selection it defaults
 * to Sevilla (Valle del Cauca) — the app's home municipio — so the initial
 * view is a real, fully-dynamic place rather than a hardcoded study area.
 */
export interface Region {
  /** The selected municipio's DIVIPOLA code. */
  code: string
  /** DIVIPOLA municipio code(s) whose veredas + models should load. Always one entry; kept as an array for the API contract. */
  codes: string[]
  /** Map center `[lat, lon]` (the municipio centroid). */
  center: [number, number]
  /** Map framing bounds `[[south, west], [north, east]]`. */
  bounds: [[number, number], [number, number]]
  /** Human label, e.g. "Sevilla, Valle Del Cauca". */
  label: string
  /** The municipio name on its own, e.g. "Sevilla". */
  municipioName: string
  /** The department name on its own, e.g. "Valle Del Cauca". */
  departamento: string
}

// Half-width, in degrees, of the framing box drawn around a municipio's
// centroid (~15 km). Initial framing only — the fetched layers can be
// panned/zoomed freely afterward.
const MARGIN_DEG = 0.14

export function resolveRegion(code: string | null | undefined): Region {
  const municipio = getMunicipioByCode(code) ?? getMunicipioByCode(DEFAULT_MUNICIPIO_CODE)!

  return {
    code: municipio.code,
    codes: [municipio.code],
    center: [municipio.lat, municipio.lon],
    bounds: [
      [municipio.lat - MARGIN_DEG, municipio.lon - MARGIN_DEG],
      [municipio.lat + MARGIN_DEG, municipio.lon + MARGIN_DEG],
    ],
    label: `${municipio.name}, ${municipio.dep}`,
    municipioName: municipio.name,
    departamento: municipio.dep,
  }
}

/** Query-string fragment scoping any region-aware API to the selected municipio. */
export function regionQuery(region: Region): string {
  return `?municipio=${region.codes.join(",")}`
}
