/**
 * Client-safe types and metadata for "Sitios críticos" — field-surveyed
 * road-infrastructure damage points (landslides, collapses, erosion,
 * subgrade sinking, tension cracks) published by the Valle del Cauca
 * infrastructure secretariat's ArcGIS Server, layer index 1 on each
 * municipality's MapServer:
 * https://infraestructura.valledelcauca.gov.co/server/rest/services/{Sevilla,Caicedonia,Zarzal}/MapServer/1
 *
 * This is a different signal than the modeled `VIGIA_Amenaza_IS_*`
 * susceptibility index (lib/deslizamientos/client.ts): these are specific,
 * ground-verified failure points from a single field survey, not a
 * continuous statistical model. No server imports here — kept separate from
 * lib/deslizamientos/critical-sites.ts (the server-only fetcher) so this
 * file can be imported by client components too.
 */

export type CriticalSiteTipo =
  | "Hundimiento de subrasante"
  | "Detritos en la vía"
  | "Abultamiento de la carretera"
  | "Cambios de forma"
  | "Deformación de estructuras adyacentes"
  | "Erosión"
  | "Derrumbe"
  | "Deslizamiento"
  | "Grietas de tracción"

/**
 * Raw `TIPO` coded-value domain (`WS4_TIPO_SITIOSCRITICOS`) collapsed to one
 * label per code — codes 5 and 6 share an identical domain name upstream
 * ("Deformación de estructuras adyacentes"), so both map to the same label.
 */
const TIPO_LABELS: Record<number, CriticalSiteTipo> = {
  1: "Hundimiento de subrasante",
  2: "Detritos en la vía",
  3: "Abultamiento de la carretera",
  4: "Cambios de forma",
  5: "Deformación de estructuras adyacentes",
  6: "Deformación de estructuras adyacentes",
  7: "Erosión",
  8: "Derrumbe",
  9: "Deslizamiento",
  10: "Grietas de tracción",
}

export function tipoLabel(code: number): CriticalSiteTipo | "Sin clasificar" {
  return TIPO_LABELS[code] ?? "Sin clasificar"
}

export const CRITICAL_SITE_SEVERITIES = [1, 2, 3, 4] as const
export type CriticalSiteSeverity = (typeof CRITICAL_SITE_SEVERITIES)[number]

export interface CriticalSiteSeverityStyle {
  code: CriticalSiteSeverity
  label: string
  swatchClass: string
  colorToken: string
}

/** Raw `SEVERIDAD` coded-value domain (`WS4_SEVERIDAD`), 1 (no damage) to 4 (urgent repair). */
export const CRITICAL_SITE_SEVERITY_STYLES: Record<CriticalSiteSeverity, CriticalSiteSeverityStyle> = {
  1: {
    code: 1,
    label: "Sin daño o insignificante",
    swatchClass: "bg-critical-site-1",
    colorToken: "var(--critical-site-1)",
  },
  2: {
    code: 2,
    label: "Daño leve, sin reparación necesaria",
    swatchClass: "bg-critical-site-2",
    colorToken: "var(--critical-site-2)",
  },
  3: {
    code: 3,
    label: "Daño leve, reparación necesaria",
    swatchClass: "bg-critical-site-3",
    colorToken: "var(--critical-site-3)",
  },
  4: {
    code: 4,
    label: "Daño grave, reparación urgente",
    swatchClass: "bg-critical-site-4",
    colorToken: "var(--critical-site-4)",
  },
}

export function isCriticalSiteSeverity(value: number): value is CriticalSiteSeverity {
  return (CRITICAL_SITE_SEVERITIES as readonly number[]).includes(value)
}

export function severityColorToken(severidad: number): string {
  return isCriticalSiteSeverity(severidad)
    ? CRITICAL_SITE_SEVERITY_STYLES[severidad].colorToken
    : "var(--muted-foreground)"
}

export interface CriticalSitePoint {
  id: string
  lat: number
  lon: number
  municipio: string
  /** Raw `TIPO` code, 1–10. Use `tipoLabel()` for display. */
  tipo: number
  /** Raw `SEVERIDAD` code, 1–4. Use `CRITICAL_SITE_SEVERITY_STYLES` for display. */
  severidad: number
  /** Survey date, e.g. "2019-07-15". The source is a single historical field survey, not a live feed. */
  fecha: string | null
  observaciones: string | null
  codigoVia: string | null
}

export interface CriticalSitesResponse {
  generatedAt: string
  /** Date of the underlying field survey (identical across all records: "2019-07-15"). */
  surveyDate: string | null
  points: CriticalSitePoint[]
}

export interface CriticalSitesErrorResponse {
  error: string
}
