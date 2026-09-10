/**
 * Deterministic Spanish narrative templates for the compound risk report —
 * pure string templates filled from already-computed numbers, never a
 * free-text/LLM generation. No server imports, so the same functions can
 * run server-side (embedded into the API response, see
 * lib/riesgo-compuesto/server.ts) or client-side if ever needed.
 */

import type { CompoundLevel, IdeamActionTier } from "./levels"
import type { CompoundNarrative, HazardName, SubHazardSummary } from "./api-types"

function actionVerb(tier: IdeamActionTier): string {
  if (tier === "Informar") return "informar"
  if (tier === "Prepararse") return "prepararse"
  return "actuar"
}

export function buildResumen({
  nombre,
  municipio,
  compoundLevel,
  actionTier,
  dominantHazard,
  subHazards,
}: {
  nombre: string
  municipio: string
  compoundLevel: CompoundLevel | null
  actionTier: IdeamActionTier | null
  dominantHazard: HazardName | null
  subHazards: SubHazardSummary[]
}): string {
  if (!compoundLevel || !actionTier) {
    return `No hay suficientes datos de ninguno de los cuatro modelos de amenaza para calcular un riesgo compuesto en ${nombre} (${municipio}).`
  }
  const dominant = subHazards.find((h) => h.hazard === dominantHazard)
  const dominantText = dominant
    ? ` La amenaza que domina este resultado es ${dominant.label.toLowerCase()}, con nivel ${dominant.rawLevel ?? "—"}.`
    : ""
  return `${nombre} (${municipio}) tiene un riesgo compuesto ${compoundLevel.toLowerCase()}: siguiendo la guía de IDEAM, corresponde ${actionVerb(actionTier)} (${actionTier.toLowerCase()}).${dominantText}`
}

export function buildDesglose(subHazards: SubHazardSummary[]): string {
  const parts = subHazards.map((h) => {
    if (!h.rawLevel) return `${h.label}: sin datos`
    return `${h.label}: ${h.rawLevel}${h.detail ? ` (${h.detail})` : ""}`
  })
  return `Desglose por amenaza — ${parts.join("; ")}.`
}

export function buildDemografia({
  poblacion,
  escuelas,
  hospitales,
  farmacias,
  infraestructuraCritica,
  sitiosCriticos,
}: {
  poblacion: number | null
  escuelas: number | null
  hospitales: number | null
  farmacias: number | null
  infraestructuraCritica: number | null
  sitiosCriticos: number
}): string {
  if (poblacion == null) {
    return `No hay datos de población o infraestructura de RED LabOT para esta vereda (fuera de su cobertura). Sitios críticos registrados en 2019: ${sitiosCriticos}.`
  }
  return `Población estimada expuesta: ${Math.round(poblacion).toLocaleString("es-CO")}. Escuelas: ${escuelas ?? "—"} · Hospitales: ${hospitales ?? "—"} · Farmacias: ${farmacias ?? "—"} · Infraestructura crítica: ${infraestructuraCritica ?? "—"}. Sitios críticos registrados en 2019: ${sitiosCriticos}.`
}

export function buildNarrative(args: {
  nombre: string
  municipio: string
  compoundLevel: CompoundLevel | null
  actionTier: IdeamActionTier | null
  dominantHazard: HazardName | null
  subHazards: SubHazardSummary[]
  poblacion: number | null
  escuelas: number | null
  hospitales: number | null
  farmacias: number | null
  infraestructuraCritica: number | null
  sitiosCriticos: number
}): CompoundNarrative {
  return {
    resumen: buildResumen(args),
    desglose: buildDesglose(args.subHazards),
    demografia: buildDemografia(args),
  }
}
