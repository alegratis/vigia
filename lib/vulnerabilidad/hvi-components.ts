/**
 * Client-safe Spanish labels for the 8 "déficit habitacional cualitativo"
 * components behind the rural, municipio-level HVI (see
 * lib/vulnerabilidad/hvi.ts's `HVI_COMPONENTS`). Kept in sync with that
 * server module's keys — used to label the rural breakdown bar chart. No
 * server imports.
 */
export const HVI_COMPONENT_LABELS: Record<string, string> = {
  CompParedesExteriores: "Paredes exteriores inadecuadas",
  CompMaterialPisos: "Material de pisos inadecuado",
  CompHacinMitigable: "Hacinamiento mitigable",
  CompHacinNoMitigable: "Hacinamiento no mitigable",
  CompAcueducto: "Sin acueducto adecuado",
  CompAlcantarillado: "Sin alcantarillado adecuado",
  CompEnergia: "Sin energía adecuada",
  CompRecBasura: "Sin recolección de basuras adecuada",
}

export const HVI_COMPONENT_ORDER = Object.keys(HVI_COMPONENT_LABELS)
