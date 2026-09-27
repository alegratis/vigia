/**
 * Client-safe Spanish labels for the 10 components behind the rural,
 * municipio-level IVS (see lib/vulnerabilidad/ivs.ts's `IVS_COMPONENTS`) —
 * 8 "déficit habitacional cualitativo" components (Vivienda + Servicios)
 * plus the 2 "condiciones de vida" components (Educación + Trabajo). Kept
 * in sync with that server module's keys — used to label the rural
 * breakdown bar chart. No server imports.
 */
export const IVS_COMPONENT_LABELS: Record<string, string> = {
  CompParedesExteriores: "Paredes exteriores inadecuadas",
  CompMaterialPisos: "Material de pisos inadecuado",
  CompHacinMitigable: "Hacinamiento mitigable",
  CompHacinNoMitigable: "Hacinamiento no mitigable",
  CompAcueducto: "Sin acueducto adecuado",
  CompAlcantarillado: "Sin alcantarillado adecuado",
  CompEnergia: "Sin energía adecuada",
  CompRecBasura: "Sin recolección de basuras adecuada",
  ComponenteInasistenciaEscolar: "Inasistencia escolar (6–17 años)",
  ComponenteDependenciaEconomica: "Alta dependencia económica",
}

export const IVS_COMPONENT_ORDER = Object.keys(IVS_COMPONENT_LABELS)

/** Which dimension each component belongs to, for grouping the breakdown chart by dimension (Vivienda 0.25 / Servicios 0.25 / Educación 0.20 / Trabajo 0.15 — Salud excluded, see lib/vulnerabilidad/ivs.ts doc comment). */
export const IVS_COMPONENT_DIMENSION: Record<string, "Vivienda" | "Servicios" | "Educación" | "Trabajo"> = {
  CompParedesExteriores: "Vivienda",
  CompMaterialPisos: "Vivienda",
  CompHacinMitigable: "Vivienda",
  CompHacinNoMitigable: "Vivienda",
  CompAcueducto: "Servicios",
  CompAlcantarillado: "Servicios",
  CompEnergia: "Servicios",
  CompRecBasura: "Servicios",
  ComponenteInasistenciaEscolar: "Educación",
  ComponenteDependenciaEconomica: "Trabajo",
}
