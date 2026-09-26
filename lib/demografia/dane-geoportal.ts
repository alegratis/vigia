/**
 * Server-only fetch helpers against DANE's public ArcGIS REST geoportal
 * (geoportal.dane.gov.co) — unauthenticated, plain `fetch`, confirmed live
 * against production. Backs the Demografía tab's two DANE indicators (see
 * v0_plans/grand-method.md, Part 2):
 *
 * - Pobreza multidimensional (matches geoportal.dane.gov.co/visipm):
 *   `INDICADORES_COND_DE_VIDA/Serv_Mpios_IndPobrezaMultidimensional_2018`,
 *   layer 4 — one polygon per municipio, field `IPM` (% of the population
 *   in multidimensional poverty).
 * - Viviendas, Hogares y Personas (matches the estadisticas-integradas
 *   geovisor, cod_dimension=1): `MARCO_INTEGRADO/Serv_DatosCNPV2018_Integrados_MGN2018`,
 *   layer 808 ("Manzana Integrada") — one polygon per city block, with
 *   `TVIVIENDA`/`TP16_HOG`/`TP27_PERSO` (viviendas/hogares/personas) counts
 *   from the 2018 census.
 *
 * Both datasets are static (2018 census / 2018 IPM), so responses are
 * cached long — same `next: { revalidate }` convention as every other
 * ArcGIS fetch in this app (e.g. lib/inundaciones/streams.ts).
 */

const BASE_URL = "https://geoportal.dane.gov.co/mparcgis/rest/services"
const IPM_LAYER_URL = `${BASE_URL}/INDICADORES_COND_DE_VIDA/Serv_Mpios_IndPobrezaMultidimensional_2018/MapServer/4`
const MANZANA_LAYER_URL = `${BASE_URL}/MARCO_INTEGRADO/Serv_DatosCNPV2018_Integrados_MGN2018/MapServer/808`

// Static reference data (2018 census / 2018 IPM) — safe to cache for a long stretch.
const REVALIDATE_SECONDS = 2_592_000 // 30 days

/** DIVIPOLA municipio codes (`MPIO_CCDGO`/`MPIO_CDPMP`, 5-digit dept+municipio) for the 4 study municipios. */
export const STUDY_MUNICIPIO_CODES = {
  Sevilla: "76736",
  Caicedonia: "76122",
  Zarzal: "76895",
  Roldanillo: "76622",
} as const

const CODES_IN_LIST = Object.values(STUDY_MUNICIPIO_CODES)
  .map((code) => `'${code}'`)
  .join(",")

export interface PobrezaFeature {
  type: "Feature"
  properties: {
    municipio: string
    codigoMunicipio: string
    /** % of households in multidimensional poverty (DANE IPM 2018). */
    ipm: number
  }
  geometry: GeoJSON.Geometry
}

export interface PobrezaFeatureCollection {
  type: "FeatureCollection"
  features: PobrezaFeature[]
}

/**
 * Municipio-level multidimensional poverty index polygons for the 4 study
 * municipios (matches geoportal.dane.gov.co/visipm).
 */
export async function getPobrezaMultidimensional(): Promise<PobrezaFeatureCollection> {
  const params = new URLSearchParams({
    where: `MPIO_CCDGO IN (${CODES_IN_LIST})`,
    outFields: "MPIO_CNMBR,MPIO_CCDGO,IPM",
    outSR: "4326",
    f: "geojson",
  })
  const res = await fetch(`${IPM_LAYER_URL}/query?${params}`, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!res.ok) {
    throw new Error(`DANE IPM query failed (${res.status})`)
  }
  const raw = (await res.json()) as {
    features: { type: "Feature"; properties: Record<string, unknown>; geometry: GeoJSON.Geometry }[]
  }
  return {
    type: "FeatureCollection",
    features: raw.features.map((f) => ({
      type: "Feature",
      properties: {
        municipio: String(f.properties.MPIO_CNMBR ?? ""),
        codigoMunicipio: String(f.properties.MPIO_CCDGO ?? ""),
        ipm: Number(f.properties.IPM ?? 0),
      },
      geometry: f.geometry,
    })),
  }
}

export interface ManzanaFeature {
  type: "Feature"
  properties: {
    codigoMunicipio: string
    codigoManzana: string
    viviendas: number
    hogares: number
    personas: number
  }
  geometry: GeoJSON.Geometry
}

export interface ManzanaFeatureCollection {
  type: "FeatureCollection"
  features: ManzanaFeature[]
}

/**
 * City-block ("manzana") level viviendas/hogares/personas counts for the 4
 * study municipios, from the 2018 census (matches the estadisticas-integradas
 * geovisor, cod_dimension=1). Paginated: ~2,174 manzanas across the 4
 * municipios exceeds the service's 2,000-record page size.
 */
export async function getViviendasHogaresPersonas(): Promise<ManzanaFeatureCollection> {
  const pageSize = 2000
  const features: ManzanaFeature[] = []
  let offset = 0

  while (true) {
    const params = new URLSearchParams({
      where: `MPIO_CDPMP IN (${CODES_IN_LIST})`,
      outFields: "MPIO_CDPMP,COD_DANE_A,TVIVIENDA,TP16_HOG,TP27_PERSO",
      outSR: "4326",
      resultRecordCount: String(pageSize),
      resultOffset: String(offset),
      f: "geojson",
    })
    const res = await fetch(`${MANZANA_LAYER_URL}/query?${params}`, { next: { revalidate: REVALIDATE_SECONDS } })
    if (!res.ok) {
      throw new Error(`DANE manzana query failed (${res.status})`)
    }
    const page = (await res.json()) as {
      features: { type: "Feature"; properties: Record<string, unknown>; geometry: GeoJSON.Geometry }[]
    }
    for (const f of page.features) {
      features.push({
        type: "Feature",
        properties: {
          codigoMunicipio: String(f.properties.MPIO_CDPMP ?? ""),
          codigoManzana: String(f.properties.COD_DANE_A ?? ""),
          viviendas: Number(f.properties.TVIVIENDA ?? 0),
          hogares: Number(f.properties.TP16_HOG ?? 0),
          personas: Number(f.properties.TP27_PERSO ?? 0),
        },
        geometry: f.geometry,
      })
    }
    if (page.features.length < pageSize) break
    offset += pageSize
  }

  return { type: "FeatureCollection", features }
}
