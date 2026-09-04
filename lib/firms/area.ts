/**
 * NASA FIRMS active-fire monitoring configuration for the Vigía study area.
 *
 * Priority zone: Valle del Cauca — Sevilla, Caicedonia and Zarzal.
 * The bounding box adds a margin around the three municipalities so that
 * fires on the surrounding cordillera slopes are captured.
 */

export const DEPARTMENT = "Valle del Cauca"

/** Bounding box as [west, south, east, north] (lon/lat, WGS84). */
export const STUDY_AREA = {
  west: -76.15,
  south: 4.15,
  east: -75.75,
  north: 4.5,
} as const

/** FIRMS `area` API wants the box as "west,south,east,north". */
export function areaCoordinates(): string {
  return `${STUDY_AREA.west},${STUDY_AREA.south},${STUDY_AREA.east},${STUDY_AREA.north}`
}

/**
 * VIIRS 375 m sources combined for fuller coverage of small fires.
 * S-NPP plus the two NOAA operational platforms.
 */
export const FIRMS_SOURCES = [
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
] as const

export type FirmsSource = (typeof FIRMS_SOURCES)[number]

/** Human labels for the municipalities used to tag nearby detections. */
export const REFERENCE_POINTS = [
  { name: "Sevilla", lat: 4.2717, lon: -75.9386 },
  { name: "Caicedonia", lat: 4.3339, lon: -75.83 },
  { name: "Zarzal", lat: 4.3925, lon: -76.0706 },
] as const
