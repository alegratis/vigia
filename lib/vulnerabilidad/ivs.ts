import "server-only"

/**
 * Step 1 of the vulnerability-index methodology (see v0_plans/grand-method.md,
 * Part A) — Índice de Vulnerabilidad Social (IVS). Four real dimensions,
 * weighted, at two resolutions depending on what DANE actually publishes:
 *
 * - **Vivienda** (0.25) — avg(paredes, pisos, hacinamiento mitigable,
 *   hacinamiento no mitigable).
 * - **Servicios públicos** (0.25) — avg(acueducto, alcantarillado, energía,
 *   recolección de basuras).
 * - **Educación** (0.20) — % hogares con inasistencia escolar (niños/as
 *   6–17 que no asisten).
 * - **Trabajo** (0.15) — % hogares con alta dependencia económica (DANE's
 *   2018-vintage proxy for informalidad/desempleo, which only exist at
 *   department level or in older census rounds — not usable at this
 *   resolution).
 *
 * These four weights (0.25+0.25+0.20+0.15 = 0.85) are renormalized by
 * dividing by 0.85 so they still sum to 1 across the dimensions we can
 * actually measure.
 *
 * **Salud is explicitly excluded.** No DANE 2018 service publishes
 * municipio-level health-insurance-affiliation or infant-mortality data
 * for these 4 municipios (checked `INDICADORES_EST_VIT` and the rest of
 * the geoportal) — rather than fabricate this dimension, it is left out
 * and documented here and in the UI, the same honesty convention as the
 * rural-vereda IVS inheriting its municipio's value below.
 *
 * Two resolutions, applied to whichever geometry can actually support them:
 *
 * - **Urban cores ("Casco Urbano" pseudo-veredas)**: DANE's manzana-level
 *   IPM (lib/demografia/dane-geoportal.ts's `getPobrezaMultidimensional`,
 *   ~2,174 city blocks) is averaged per municipio and min-max normalized
 *   across the 4 study municipios — a genuinely finer, block-level-derived
 *   IVS specific to each municipio's urban core, distinct from its rural
 *   veredas. See `getUrbanIvsByMunicipio`. Educación/Trabajo aren't
 *   published at manzana resolution, so the urban IVS stays IPM-only
 *   (Vivienda+Servicios granularity) — another honest resolution gap, not
 *   a design choice.
 * - **Rural veredas**: the manzana/IPM layer only covers urban/poblado
 *   blocks, not the dispersed rural veredas that make up most of these 4
 *   municipios' area, so no finer-than-municipio data exists for them from
 *   DANE on any of the 4 dimensions. They keep the municipio-level IVS
 *   below — every rural vereda in a municipio inherits the same value (see
 *   lib/vulnerabilidad/combined-score.ts), which is an honest data
 *   limitation, not a design choice.
 *
 * The ten municipio-level components come from two official DANE annexes on
 * the 2018 census, extracted once by `scripts/dane/extract-ivs-componentes.py`
 * into `data/ivs-componentes-2018.json` (no runtime call to DANE):
 *
 * - Déficit habitacional (2020 methodology), households with each deficiency
 *   divided by the municipio's total households: `CompParedesExteriores`,
 *   `CompMaterialPisos`, `CompHacinMitigable`, `CompHacinNoMitigable`,
 *   `CompAcueducto` (agua para cocinar), `CompAlcantarillado`, `CompEnergia`,
 *   `CompRecBasura`.
 * - NBI, share of people in the component: `ComponenteInasistenciaEscolar`,
 *   `ComponenteDependenciaEconomica`.
 */

import { STUDY_MUNICIPIO_CODES, getPobrezaMultidimensional } from "@/lib/demografia/dane-geoportal"
import ivsComponentesFile from "./data/ivs-componentes-2018.json"

const IVS_COMPONENTS = [
  "CompParedesExteriores",
  "CompMaterialPisos",
  "CompHacinMitigable",
  "CompHacinNoMitigable",
  "CompAcueducto",
  "CompAlcantarillado",
  "CompEnergia",
  "CompRecBasura",
  "ComponenteInasistenciaEscolar",
  "ComponenteDependenciaEconomica",
] as const

type IvsComponent = (typeof IVS_COMPONENTS)[number]

const IVS_COMPONENTS_BY_MUNICIPIO = ivsComponentesFile.municipios as unknown as Record<
  string,
  { municipio: string; componentes: Record<IvsComponent, number> }
>

/** Vivienda (0.25) + Servicios (0.25) + Educación (0.20) + Trabajo (0.15) = 0.85 of the full instructions' weighting — Salud is excluded (no DANE 2018 data at this resolution), so these 4 are renormalized to sum to 1. */
const VIVIENDA_COMPONENTS = ["CompParedesExteriores", "CompMaterialPisos", "CompHacinMitigable", "CompHacinNoMitigable"] as const satisfies readonly IvsComponent[]
const SERVICIOS_COMPONENTS = ["CompAcueducto", "CompAlcantarillado", "CompEnergia", "CompRecBasura"] as const satisfies readonly IvsComponent[]

const DIMENSION_WEIGHTS = {
  vivienda: 0.25,
  servicios: 0.25,
  educacion: 0.2,
  trabajo: 0.15,
} as const
const WEIGHT_SUM = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0) // 0.85 — Salud excluded

export interface MunicipioIvs {
  municipio: string
  codigoMunicipio: string
  /** Raw weighted average % across the 4 real dimensions (0–100), before normalization. */
  componentAvgPct: number
  /** Min-max normalized IVS across the 4 study municipios (0–1, higher = more socially vulnerable). */
  ivs: number
  /** The 10 raw component percentages behind the 4 dimensions, for the rural-vereda breakdown chart — this municipio's finest available granularity. */
  components: Record<IvsComponent, number>
}

export interface ManzanaIvs {
  codigoManzana: string
  /** Name of the Sevilla barrio this manzana's centroid falls inside (point-in-polygon, see lib/barrios/boundaries.ts), or `null` outside Sevilla or outside every mapped barrio. Use this instead of `codigoManzana` for anything shown to a person. */
  barrio: string | null
  /** Raw IPM (%) for this manzana. */
  ipm: number
  /** Min-max normalized IVS across every manzana in the 4 study municipios' urban cores (0–1) — the bar-chart height for this manzana. Vivienda+Servicios only (Educación/Trabajo aren't published at manzana resolution). */
  ivs: number
  /** This manzana's own polygon (from the IPM layer), so the map can render one true block-level feature per manzana instead of a single aggregated shape for the whole urban core. */
  geometry: GeoJSON.Geometry
}

export interface UrbanMunicipioIvs {
  municipio: string
  codigoMunicipio: string
  /** Manzana count backing this municipio's urban-core average, for transparency in the UI. */
  manzanaCount: number
  /** Raw average IPM (%) across every manzana in this municipio's urban core. */
  avgIpmPct: number
  /** Min-max normalized IVS across the 4 study municipios' urban cores (0–1). */
  ivs: number
  /** Every manzana behind `avgIpmPct`, sorted by `ivs` descending — for the manzana-level breakdown bar chart. */
  manzanas: ManzanaIvs[]
}

/**
 * Urban-core IVS: averages manzana-level IPM (multidimensional poverty,
 * the finest DANE resolution available — see `getPobrezaMultidimensional`)
 * per municipio, then min-max normalizes across the 4 study municipios.
 * Used only for each municipio's "Casco Urbano" pseudo-vereda — rural
 * veredas have no manzana coverage and keep the coarser municipio-wide
 * IVS from `getSocialVulnerabilityIndex`. Also keeps every individual
 * manzana's normalized IVS (`manzanas`) so the UI can chart the actual
 * block-level distribution behind each municipio's average, not just the
 * average itself.
 */
export async function getUrbanIvsByMunicipio(): Promise<UrbanMunicipioIvs[]> {
  const { features } = await getPobrezaMultidimensional()

  const ipmValues = features.map((f) => f.properties.ipm)
  const ipmMin = Math.min(...ipmValues, 0)
  const ipmMax = Math.max(...ipmValues, 1)
  const normalizeIpm = (ipm: number) => (ipmMax > ipmMin ? (ipm - ipmMin) / (ipmMax - ipmMin) : 0.5)

  const byMunicipio = new Map<
    string,
    { nombre: string; sum: number; count: number; manzanas: ManzanaIvs[] }
  >()
  for (const f of features) {
    const entry =
      byMunicipio.get(f.properties.codigoMunicipio) ??
      { nombre: f.properties.municipio, sum: 0, count: 0, manzanas: [] }
    entry.sum += f.properties.ipm
    entry.count += 1
    entry.manzanas.push({
      codigoManzana: f.properties.codigoManzana,
      barrio: f.properties.barrio,
      ipm: f.properties.ipm,
      ivs: normalizeIpm(f.properties.ipm),
      geometry: f.geometry,
    })
    byMunicipio.set(f.properties.codigoMunicipio, entry)
  }

  const rows = Object.values(STUDY_MUNICIPIO_CODES).map((codigo) => {
    const entry = byMunicipio.get(codigo)
    return {
      codigoMunicipio: codigo,
      municipio: entry?.nombre ?? "",
      manzanaCount: entry?.count ?? 0,
      avgIpmPct: entry && entry.count > 0 ? entry.sum / entry.count : 0,
      manzanas: (entry?.manzanas ?? []).slice().sort((a, b) => b.ivs - a.ivs),
    }
  })

  const values = rows.map((r) => r.avgIpmPct)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return rows.map((r) => ({
    ...r,
    ivs: max > min ? (r.avgIpmPct - min) / (max - min) : 0.5,
  }))
}

/**
 * Índice de Vulnerabilidad Social per study municipio — weighted average
 * of 4 real dimensions (Vivienda 0.25, Servicios 0.25, Educación 0.20,
 * Trabajo 0.15, renormalized to sum to 1 since Salud is excluded),
 * min-max normalized across just these 4 municipios (the study area, not
 * all of Colombia — the "normalize to 0-1" step is scoped to the
 * comparison set this app actually maps).
 */
export async function getSocialVulnerabilityIndex(): Promise<MunicipioIvs[]> {
  const codes = Object.values(STUDY_MUNICIPIO_CODES)
  const rows = codes.map((codigo) => {
    const entry = IVS_COMPONENTS_BY_MUNICIPIO[codigo]
    const nombre = entry?.municipio ?? ""
    const components = Object.fromEntries(
      IVS_COMPONENTS.map((component) => [component, entry?.componentes[component] ?? 0]),
    ) as Record<IvsComponent, number>

    const avg = (keys: readonly IvsComponent[]) => keys.reduce((sum, k) => sum + components[k], 0) / keys.length

    const vivienda = avg(VIVIENDA_COMPONENTS)
    const servicios = avg(SERVICIOS_COMPONENTS)
    const educacion = components.ComponenteInasistenciaEscolar
    const trabajo = components.ComponenteDependenciaEconomica

    const componentAvgPct =
      (DIMENSION_WEIGHTS.vivienda * vivienda +
        DIMENSION_WEIGHTS.servicios * servicios +
        DIMENSION_WEIGHTS.educacion * educacion +
        DIMENSION_WEIGHTS.trabajo * trabajo) /
      WEIGHT_SUM

    return { codigoMunicipio: codigo, municipio: nombre, componentAvgPct, components }
  })

  const values = rows.map((r) => r.componentAvgPct)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return rows.map((r) => ({
    ...r,
    ivs: max > min ? (r.componentAvgPct - min) / (max - min) : 0.5,
  }))
}
