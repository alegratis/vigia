/**
 * Client-safe Spanish labels for the 8 "déficit habitacional cualitativo"
 * components behind the rural, municipio-level IVH (see
 * lib/vulnerabilidad/ivh.ts's `IVH_COMPONENTS`). Kept in sync with that
 * server module's keys — used to label the rural breakdown bar chart. No
 * server imports.
 */
export const IVH_COMPONENT_LABELS: Record<string, string> = {
  CompParedesExteriores: "Paredes exteriores inadecuadas",
  CompMaterialPisos: "Material de pisos inadecuado",
  CompHacinMitigable: "Hacinamiento mitigable",
  CompHacinNoMitigable: "Hacinamiento no mitigable",
  CompAcueducto: "Sin acueducto adecuado",
  CompAlcantarillado: "Sin alcantarillado adecuado",
  CompEnergia: "Sin energía adecuada",
  CompRecBasura: "Sin recolección de basuras adecuada",
}

export const IVH_COMPONENT_ORDER = Object.keys(IVH_COMPONENT_LABELS)
