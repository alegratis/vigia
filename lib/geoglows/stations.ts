/**
 * Monitored river reaches for the priority study area: Valle del Cauca,
 * around Sevilla, Caicedonia and Zarzal. Reach IDs were resolved from the
 * GEOGLOWS v2 `getriverid` endpoint and validated against live forecast flow
 * magnitudes so each station points at a flood-relevant channel rather than a
 * minor tributary.
 *
 * The backend is fully general (any lat/lon or reach id can be assessed), but
 * these named stations are the default watch list for the flood section.
 */

export interface Station {
  /** URL-safe identifier. */
  slug: string
  /** GEOGLOWS v2 reach id. */
  reachId: number
  /** Display name (Spanish). */
  name: string
  /** River/body of water. */
  river: string
  /** Municipality. */
  municipality: string
  /** Department (all Valle del Cauca for now). */
  department: string
  lat: number
  lon: number
  /** Short Spanish note about why this reach matters. */
  note: string
}

export const DEPARTMENT = "Valle del Cauca"

export const STATIONS: Station[] = [
  {
    slug: "cauca-zarzal",
    reachId: 610457350,
    name: "Río Cauca — Zarzal",
    river: "Río Cauca",
    municipality: "Zarzal",
    department: DEPARTMENT,
    lat: 4.405,
    lon: -76.075,
    note: "Cauce principal del valle; principal amenaza de inundación para Zarzal y La Victoria.",
  },
  {
    slug: "la-vieja-sevilla",
    reachId: 610408956,
    name: "Río La Vieja — corredor Sevilla",
    river: "Río La Vieja",
    municipality: "Sevilla",
    department: DEPARTMENT,
    lat: 4.44,
    lon: -75.92,
    note: "Drena la vertiente de Sevilla y Caicedonia hacia el Cauca.",
  },
  {
    slug: "caicedonia",
    reachId: 610397522,
    name: "Río de Caicedonia",
    river: "Cauce de Caicedonia",
    municipality: "Caicedonia",
    department: DEPARTMENT,
    lat: 4.3339,
    lon: -75.83,
    note: "Cauce urbano de Caicedonia con crecientes rápidas por lluvias de montaña.",
  },
  {
    slug: "pijao-caicedonia",
    reachId: 610270800,
    name: "Río Pijao — Caicedonia",
    river: "Río Pijao",
    municipality: "Caicedonia",
    department: DEPARTMENT,
    lat: 4.34,
    lon: -75.87,
    note: "Río de montaña que atraviesa el área de Caicedonia; respuesta rápida ante lluvias intensas.",
  },
  {
    slug: "quebrada-sevilla",
    reachId: 610329767,
    name: "Quebrada urbana — Sevilla",
    river: "Quebrada de Sevilla",
    municipality: "Sevilla",
    department: DEPARTMENT,
    lat: 4.2717,
    lon: -75.9386,
    note: "Cauce menor que cruza el casco urbano de Sevilla; vigilancia por crecientes súbitas.",
  },
  {
    slug: "quebrada-sevilla-alta",
    reachId: 610226803,
    name: "Quebrada alta — Sevilla",
    river: "Quebrada de montaña",
    municipality: "Sevilla",
    department: DEPARTMENT,
    lat: 4.29,
    lon: -75.92,
    note: "Cuerpo de agua menor en la vertiente alta de Sevilla que alimenta los cauces del corredor.",
  },
]

export function getStationBySlug(slug: string): Station | undefined {
  return STATIONS.find((s) => s.slug === slug)
}

export function getStationByReachId(reachId: number): Station | undefined {
  return STATIONS.find((s) => s.reachId === reachId)
}
