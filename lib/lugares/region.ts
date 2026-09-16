import { getMunicipioByCode, STUDY_AREA_MUNICIPIO_CODES } from "./registry"

/**
 * Resolves the app's "active region" from a selected municipio code. This is
 * the single anchor every map and the vereda backbone read from, replacing
 * the constants that used to hardcode the three-municipio study area.
 *
 * - No selection (`null`) → the original study area (Sevilla, Caicedonia,
 *   Zarzal) with its hand-tuned framing, so the default view never regresses.
 * - A municipio code → that one municipio, framed from its centroid.
 */
export interface Region {
  /** DIVIPOLA municipio code(s) whose veredas + models should load. */
  codes: string[]
  /** Map center `[lat, lon]`. */
  center: [number, number]
  /** Map framing bounds `[[south, west], [north, east]]`. */
  bounds: [[number, number], [number, number]]
  /** Human label for the current selection. */
  label: string
  /** True when this is the default multi-municipio study area. */
  isStudyArea: boolean
}

// The study area's hand-tuned framing (matches the maps' previous AOI_BOUNDS).
const STUDY_AREA_BOUNDS: [[number, number], [number, number]] = [
  [3.88, -76.06],
  [4.44, -75.72],
]
const STUDY_AREA_CENTER: [number, number] = [4.16, -75.89]

// Half-width, in degrees, of the framing box drawn around a single
// municipio's centroid (~15 km). Initial framing only — the fetched vereda
// layer can be panned/zoomed freely afterward.
const SINGLE_MARGIN_DEG = 0.14

export function resolveRegion(code: string | null | undefined): Region {
  if (!code) {
    return {
      codes: [...STUDY_AREA_MUNICIPIO_CODES],
      center: STUDY_AREA_CENTER,
      bounds: STUDY_AREA_BOUNDS,
      label: "Área de estudio (Sevilla, Caicedonia, Zarzal)",
      isStudyArea: true,
    }
  }

  const municipio = getMunicipioByCode(code)
  if (!municipio) return resolveRegion(null)

  return {
    codes: [municipio.code],
    center: [municipio.lat, municipio.lon],
    bounds: [
      [municipio.lat - SINGLE_MARGIN_DEG, municipio.lon - SINGLE_MARGIN_DEG],
      [municipio.lat + SINGLE_MARGIN_DEG, municipio.lon + SINGLE_MARGIN_DEG],
    ],
    label: `${municipio.name}, ${municipio.dep}`,
    isStudyArea: false,
  }
}

/**
 * Query-string fragment for the vereda API when a specific municipio is
 * selected. Empty for the study-area default so its request URL — and thus
 * its server cache key — stays identical to before this feature existed.
 */
export function regionQuery(region: Region): string {
  return region.isStudyArea ? "" : `?municipio=${region.codes.join(",")}`
}
