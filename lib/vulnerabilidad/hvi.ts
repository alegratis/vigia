import "server-only"

/**
 * Step 1 of the vulnerability-index methodology (see v0_plans/grand-method.md,
 * Part 3) — Housing Vulnerability Index (HVI), reinterpreted at municipio
 * grain. The instructions ask for manzana/sector-level physical-fragility
 * variables (inadequate walls/floors, overcrowding, lack of services), but
 * DANE's manzana layer (lib/demografia/dane-geoportal.ts) only covers
 * urban/poblado blocks, not the dispersed rural veredas that make up most
 * of these 4 municipios — so a manzana-level HVI can't be extended to the
 * whole study area.
 *
 * DANE separately publishes exactly the named variables as ready-made
 * municipio-level "déficit habitacional cualitativo" component indicators —
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

import { STUDY_MUNICIPIO_CODES } from "@/lib/demografia/dane-geoportal"

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
    for (const componentMap of componentMaps) {
      const entry = componentMap.get(codigo)
      if (entry) {
        nombre = entry.nombre
        sum += entry.pct
        count += 1
      }
    }
    return { codigoMunicipio: codigo, municipio: nombre, componentAvgPct: count > 0 ? sum / count : 0 }
  })

  const values = rows.map((r) => r.componentAvgPct)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return rows.map((r) => ({
    ...r,
    hvi: max > min ? (r.componentAvgPct - min) / (max - min) : 0.5,
  }))
}
