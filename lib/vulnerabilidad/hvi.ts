import "server-only"

/**
 * Step 1 of the vulnerability-index methodology (see v0_plans/grand-method.md,
 * Part 3) — Housing Vulnerability Index (HVI). Two resolutions, applied to
 * whichever geometry can actually support them:
 *
 * - **Urban cores ("Casco Urbano" pseudo-veredas)**: DANE's manzana-level
 *   IPM (lib/demografia/dane-geoportal.ts's `getPobrezaMultidimensional`,
 *   ~2,174 city blocks) is averaged per municipio and min-max normalized
 *   across the 4 study municipios — a genuinely finer, block-level-derived
 *   HVI specific to each municipio's urban core, distinct from its rural
 *   veredas. See `getUrbanHviByMunicipio`.
 * - **Rural veredas**: the manzana/IPM layer only covers urban/poblado
 *   blocks, not the dispersed rural veredas that make up most of these 4
 *   municipios' area, so no finer-than-municipio physical-fragility data
 *   exists for them from DANE. They keep the municipio-level "déficit
 *   habitacional cualitativo" component average below — every rural vereda
 *   in a municipio inherits the same value (see
 *   lib/vulnerabilidad/combined-score.ts), which is an honest data
 *   limitation, not a design choice.
 *
 * DANE publishes the walls/floors/overcrowding/services variables named in
 * the instructions as ready-made municipio-level "déficit habitacional
 * cualitativo" component indicators —
 * confirmed live against production, one `MapServer` per component, all
 * sharing the same layer id (`4`) and municipio-code/name fields as the
 * other `INDICADORES_COND_DE_VIDA` services this app already queries:
 *
 * - `CompParedesExteriores` → `PC_N_pared` (% hogares con paredes inadecuadas)
 * - `CompMaterialPisos` → `PC_N_pisos` (% hogares con pisos inadecuados)
 * - `CompHacinMitigable` → `PC_N_defhacimiti` (% hogares en hacinamiento mitigable)
 * - `CompHacinNoMitigable` → `PC_N_defhaci` (% hogares en hacinamiento no mitigable)
 * - `CompAcueducto` → `PC_N_agua` (% hogares sin acueducto adecuado)
 * - `CompAlcantarillado` → `PC_N_alcantarillado` (% hogares sin alcantarillado adecuado)
 * - `CompEnergia` → `PC_N_energia` (% hogares sin energía adecuada)
 * - `CompRecBasura` → `PC_N_basura` (% hogares sin recolección de basuras adecuada)
 *
 * This *is* the walls/floors + overcrowding + services variable set the
 * instructions call for — DANE has just pre-aggregated it by municipio
 * instead of it being hand-rolled from raw manzana counts. HVI = min-max
 * normalized average of these 8 components, one value per municipio; every
 * vereda inherits its municipio's HVI (see lib/vulnerabilidad/combined-score.ts).
 */

import { STUDY_MUNICIPIO_CODES, getPobrezaMultidimensional } from "@/lib/demografia/dane-geoportal"

const BASE_URL = "https://geoportal.dane.gov.co/mparcgis/rest/services/INDICADORES_COND_DE_VIDA"

/** Service name suffix → the % field this app reads from its layer 4. */
const HVI_COMPONENTS = {
  CompParedesExteriores: "PC_N_pared",
  CompMaterialPisos: "PC_N_pisos",
  CompHacinMitigable: "PC_N_defhacimiti",
  CompHacinNoMitigable: "PC_N_defhaci",
  CompAcueducto: "PC_N_agua",
  CompAlcantarillado: "PC_N_alcantarillado",
  CompEnergia: "PC_N_energia",
  CompRecBasura: "PC_N_basura",
} as const

// Static reference data (2018 déficit habitacional) — same long-cache convention as dane-geoportal.ts.
const REVALIDATE_SECONDS = 2_592_000 // 30 days

const CODES_IN_LIST = Object.values(STUDY_MUNICIPIO_CODES)
  .map((code) => `'${code}'`)
  .join(",")

export interface MunicipioHvi {
  municipio: string
  codigoMunicipio: string
  /** Raw average % across the 8 déficit habitacional components (0–100). */
  componentAvgPct: number
  /** Min-max normalized HVI across the 4 study municipios (0–1, higher = more physically fragile housing stock). */
  hvi: number
  /** The 8 raw component percentages behind `componentAvgPct`, for the rural-vereda breakdown chart — this municipio's finest available granularity. */
  components: Record<keyof typeof HVI_COMPONENTS, number>
}

export interface ManzanaHvi {
  codigoManzana: string
  /** Raw IPM (%) for this manzana. */
  ipm: number
  /** Min-max normalized HVI across every manzana in the 4 study municipios' urban cores (0–1) — the bar-chart height for this manzana. */
  hvi: number
  /** This manzana's own polygon (from the IPM layer), so the map can render one true block-level feature per manzana instead of a single aggregated shape for the whole urban core. */
  geometry: GeoJSON.Geometry
}

export interface UrbanMunicipioHvi {
  municipio: string
  codigoMunicipio: string
  /** Manzana count backing this municipio's urban-core average, for transparency in the UI. */
  manzanaCount: number
  /** Raw average IPM (%) across every manzana in this municipio's urban core. */
  avgIpmPct: number
  /** Min-max normalized HVI across the 4 study municipios' urban cores (0–1). */
  hvi: number
  /** Every manzana behind `avgIpmPct`, sorted by `hvi` descending — for the manzana-level breakdown bar chart. */
  manzanas: ManzanaHvi[]
}

/**
 * Urban-core HVI: averages manzana-level IPM (multidimensional poverty,
 * the finest DANE resolution available — see `getPobrezaMultidimensional`)
 * per municipio, then min-max normalizes across the 4 study municipios.
 * Used only for each municipio's "Casco Urbano" pseudo-vereda — rural
 * veredas have no manzana coverage and keep the coarser municipio-wide
 * déficit habitacional HVI from `getHousingVulnerabilityIndex`. Also keeps
 * every individual manzana's normalized HVI (`manzanas`) so the UI can
 * chart the actual block-level distribution behind each municipio's
 * average, not just the average itself.
 */
export async function getUrbanHviByMunicipio(): Promise<UrbanMunicipioHvi[]> {
  const { features } = await getPobrezaMultidimensional()

  const ipmValues = features.map((f) => f.properties.ipm)
  const ipmMin = Math.min(...ipmValues, 0)
  const ipmMax = Math.max(...ipmValues, 1)
  const normalizeIpm = (ipm: number) => (ipmMax > ipmMin ? (ipm - ipmMin) / (ipmMax - ipmMin) : 0.5)

  const byMunicipio = new Map<
    string,
    { nombre: string; sum: number; count: number; manzanas: ManzanaHvi[] }
  >()
  for (const f of features) {
    const entry =
      byMunicipio.get(f.properties.codigoMunicipio) ??
      { nombre: f.properties.municipio, sum: 0, count: 0, manzanas: [] }
    entry.sum += f.properties.ipm
    entry.count += 1
    entry.manzanas.push({
      codigoManzana: f.properties.codigoManzana,
      ipm: f.properties.ipm,
      hvi: normalizeIpm(f.properties.ipm),
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
      manzanas: (entry?.manzanas ?? []).slice().sort((a, b) => b.hvi - a.hvi),
    }
  })

  const values = rows.map((r) => r.avgIpmPct)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return rows.map((r) => ({
    ...r,
    hvi: max > min ? (r.avgIpmPct - min) / (max - min) : 0.5,
  }))
}

async function fetchComponent(service: keyof typeof HVI_COMPONENTS): Promise<Map<string, { nombre: string; pct: number }>> {
  const field = HVI_COMPONENTS[service]
  const params = new URLSearchParams({
    where: `MPIO_CCDGO IN (${CODES_IN_LIST})`,
    outFields: `MPIO_CCDGO,MPIO_CNMBR,${field}`,
    f: "json",
  })
  const res = await fetch(`${BASE_URL}/Serv_Mpios_DeficitHab_${service}_2018/MapServer/4/query?${params}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  })
  if (!res.ok) {
    throw new Error(`DANE déficit habitacional query failed for ${service} (${res.status})`)
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
 * Housing Vulnerability Index per study municipio — average of the 8
 * déficit habitacional cualitativo components, min-max normalized across
 * just these 4 municipios (the study area, not all of Colombia — the
 * instructions' "normalize to 0-1" step is scoped to the comparison set
 * this app actually maps).
 */
export async function getHousingVulnerabilityIndex(): Promise<MunicipioHvi[]> {
  const services = Object.keys(HVI_COMPONENTS) as (keyof typeof HVI_COMPONENTS)[]
  const componentMaps = await Promise.all(services.map(fetchComponent))

  const codes = Object.values(STUDY_MUNICIPIO_CODES)
  const rows = codes.map((codigo) => {
    let nombre = ""
    let sum = 0
    let count = 0
    const components = {} as Record<keyof typeof HVI_COMPONENTS, number>
    services.forEach((service, i) => {
      const entry = componentMaps[i].get(codigo)
      const pct = entry?.pct ?? 0
      components[service] = pct
      if (entry) {
        nombre = entry.nombre
        sum += entry.pct
        count += 1
      }
    })
    return { codigoMunicipio: codigo, municipio: nombre, componentAvgPct: count > 0 ? sum / count : 0, components }
  })

  const values = rows.map((r) => r.componentAvgPct)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return rows.map((r) => ({
    ...r,
    hvi: max > min ? (r.componentAvgPct - min) / (max - min) : 0.5,
  }))
}
