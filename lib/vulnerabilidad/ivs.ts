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
 * DANE publishes the walls/floors/overcrowding/services variables as
 * ready-made municipio-level "déficit habitacional cualitativo" component
 * indicators, and the inasistencia escolar / dependencia económica
 * variables as "condiciones de vida" component indicators — confirmed
 * live against production, one `MapServer` per component, all sharing the
 * same layer id (`4`) and municipio-code/name fields as the other
 * `INDICADORES_COND_DE_VIDA` services this app already queries:
 *
 * - `CompParedesExteriores` → `PC_N_pared` (% hogares con paredes inadecuadas)
 * - `CompMaterialPisos` → `PC_N_pisos` (% hogares con pisos inadecuados)
 * - `CompHacinMitigable` → `PC_N_defhacimiti` (% hogares en hacinamiento mitigable)
 * - `CompHacinNoMitigable` → `PC_N_defhaci` (% hogares en hacinamiento no mitigable)
 * - `CompAcueducto` → `PC_N_agua` (% hogares sin acueducto adecuado)
 * - `CompAlcantarillado` → `PC_N_alcantarillado` (% hogares sin alcantarillado adecuado)
 * - `CompEnergia` → `PC_N_energia` (% hogares sin energía adecuada)
 * - `CompRecBasura` → `PC_N_basura` (% hogares sin recolección de basuras adecuada)
 * - `ComponenteInasistenciaEscolar` → `NBIC_Total_PP_Comp_Inasistencia` (% hogares con inasistencia escolar)
 * - `ComponenteDependenciaEconomica` → `NBIC_Total_PP_Comp_dependencia_economica` (% hogares con alta dependencia económica)
 */

import { STUDY_MUNICIPIO_CODES, getPobrezaMultidimensional } from "@/lib/demografia/dane-geoportal"

const BASE_URL = "https://geoportal.dane.gov.co/mparcgis/rest/services/INDICADORES_COND_DE_VIDA"

/** Service name suffix → the % field this app reads from its layer 4. */
const IVS_COMPONENTS = {
  CompParedesExteriores: "PC_N_pared",
  CompMaterialPisos: "PC_N_pisos",
  CompHacinMitigable: "PC_N_defhacimiti",
  CompHacinNoMitigable: "PC_N_defhaci",
  CompAcueducto: "PC_N_agua",
  CompAlcantarillado: "PC_N_alcantarillado",
  CompEnergia: "PC_N_energia",
  CompRecBasura: "PC_N_basura",
  ComponenteInasistenciaEscolar: "NBIC_Total_PP_Comp_Inasistencia",
  ComponenteDependenciaEconomica: "NBIC_Total_PP_Comp_dependencia_economica",
} as const

/** Service names, grouped by service path prefix — the school-attendance and economic-dependency components live under a different `Serv_Mpios_NBI_*` service family than the 8 déficit habitacional ones. */
const SERVICE_PATH: Record<keyof typeof IVS_COMPONENTS, string> = {
  CompParedesExteriores: "Serv_Mpios_DeficitHab_CompParedesExteriores_2018",
  CompMaterialPisos: "Serv_Mpios_DeficitHab_CompMaterialPisos_2018",
  CompHacinMitigable: "Serv_Mpios_DeficitHab_CompHacinMitigable_2018",
  CompHacinNoMitigable: "Serv_Mpios_DeficitHab_CompHacinNoMitigable_2018",
  CompAcueducto: "Serv_Mpios_DeficitHab_CompAcueducto_2018",
  CompAlcantarillado: "Serv_Mpios_DeficitHab_CompAlcantarillado_2018",
  CompEnergia: "Serv_Mpios_DeficitHab_CompEnergia_2018",
  CompRecBasura: "Serv_Mpios_DeficitHab_CompRecBasura_2018",
  ComponenteInasistenciaEscolar: "Serv_Mpios_NBI_ComponenteInasistenciaEscolar_Total_2018",
  ComponenteDependenciaEconomica: "Serv_Mpios_NBI_ComponenteDependenciaEconomica_Total_2018",
}

/** Vivienda (0.25) + Servicios (0.25) + Educación (0.20) + Trabajo (0.15) = 0.85 of the full instructions' weighting — Salud is excluded (no DANE 2018 data at this resolution), so these 4 are renormalized to sum to 1. */
const VIVIENDA_COMPONENTS = ["CompParedesExteriores", "CompMaterialPisos", "CompHacinMitigable", "CompHacinNoMitigable"] as const
const SERVICIOS_COMPONENTS = ["CompAcueducto", "CompAlcantarillado", "CompEnergia", "CompRecBasura"] as const

const DIMENSION_WEIGHTS = {
  vivienda: 0.25,
  servicios: 0.25,
  educacion: 0.2,
  trabajo: 0.15,
} as const
const WEIGHT_SUM = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0) // 0.85 — Salud excluded

// Static reference data (2018 déficit habitacional / condiciones de vida) — same long-cache convention as dane-geoportal.ts.
const REVALIDATE_SECONDS = 2_592_000 // 30 days

const CODES_IN_LIST = Object.values(STUDY_MUNICIPIO_CODES)
  .map((code) => `'${code}'`)
  .join(",")

export interface MunicipioIvs {
  municipio: string
  codigoMunicipio: string
  /** Raw weighted average % across the 4 real dimensions (0–100), before normalization. */
  componentAvgPct: number
  /** Min-max normalized IVS across the 4 study municipios (0–1, higher = more socially vulnerable). */
  ivs: number
  /** The 10 raw component percentages behind the 4 dimensions, for the rural-vereda breakdown chart — this municipio's finest available granularity. */
  components: Record<keyof typeof IVS_COMPONENTS, number>
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

async function fetchComponent(service: keyof typeof IVS_COMPONENTS): Promise<Map<string, { nombre: string; pct: number }>> {
  const field = IVS_COMPONENTS[service]
  const params = new URLSearchParams({
    where: `MPIO_CCDGO IN (${CODES_IN_LIST})`,
    outFields: `MPIO_CCDGO,MPIO_CNMBR,${field}`,
    f: "json",
  })
  const res = await fetch(`${BASE_URL}/${SERVICE_PATH[service]}/MapServer/4/query?${params}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`DANE condiciones de vida query failed for ${service} (${res.status})`)
  }
  const raw = (await res.json()) as { features: { attributes: Record<string, unknown> }[] }
  const byMunicipio = new Map<string, { nombre: string; pct: number }>()
  for (const f of raw.features) {
    const codigo = String(f.attributes.MPIO_CCDGO ?? "")
    byMunicipio.set(codigo, {
      nombre: String(f.attributes.MPIO_CNMBR ?? ""),
      pct: Number(f.attributes[field] ?? 0),
    })
  }
  return byMunicipio
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
  const services = Object.keys(IVS_COMPONENTS) as (keyof typeof IVS_COMPONENTS)[]
  const componentMaps = await Promise.all(services.map(fetchComponent))

  const codes = Object.values(STUDY_MUNICIPIO_CODES)
  const rows = codes.map((codigo) => {
    let nombre = ""
    const components = {} as Record<keyof typeof IVS_COMPONENTS, number>
    services.forEach((service, i) => {
      const entry = componentMaps[i].get(codigo)
      components[service] = entry?.pct ?? 0
      if (entry) nombre = entry.nombre
    })

    const avg = (keys: readonly (keyof typeof IVS_COMPONENTS)[]) =>
      keys.reduce((sum, k) => sum + components[k], 0) / keys.length

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
