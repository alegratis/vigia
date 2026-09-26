/**
 * Server-only fetch helpers against DANE's public ArcGIS REST geoportal
 * (geoportal.dane.gov.co) — unauthenticated, plain `fetch`, confirmed live
 * against production. Backs the Demografía tab's two DANE indicators (see
 * v0_plans/grand-method.md, Part 2):
 *
 * - Pobreza multidimensional, at **manzana** (city-block) resolution
 *   (matches the manzana-level layer behind geoportal.dane.gov.co/visipm):
 *   `POBREZA_MULTIDIMENSIONAL/Serv_MGN2020_Integrado_IPM`, layer `325`
 *   ("Pobreza Multidimensional") — one polygon per manzana, field `ipm`
 *   (% of the population in multidimensional poverty) plus a pre-bucketed
 *   `LABEL` ("Vulnerabilidad baja/media/alta"). Confirmed live: 2,174
 *   manzana features across the 4 study municipios (`COD_MPIO IN (...)`,
 *   same count as the viviendas/hogares/personas manzana layer below) —
 *   the municipio-level `Serv_Mpios_IndPobrezaMultidimensional_2018`
 *   service is DANE's older, coarser IPM layer and is no longer used here.
 *   Geometry is only served via the `FeatureServer` endpoint for this
 *   service (the `MapServer` query endpoint returns null geometry for this
 *   particular layer), so this one indicator is fetched through
 *   `FeatureServer` while the other still uses `MapServer`.
 * - Viviendas, Hogares y Personas (matches the estadisticas-integradas
 *   geovisor, cod_dimension=1): `MARCO_INTEGRADO/Serv_DatosCNPV2018_Integrados_MGN2018`,
 *   layer 808 ("Manzana Integrada") carries the `TVIVIENDA`/`TP16_HOG`/`TP27_PERSO`
 *   (viviendas/hogares/personas) counts from the 2018 census, keyed by
 *   `COD_DANE_A` — but this layer's `query` endpoint returns null geometry
 *   for every feature regardless of `f`/`returnGeometry` (confirmed live;
 *   unlike the IPM layer above, no FeatureServer alternative exists for
 *   it). Its `COD_DANE_A` manzana code is identical in format and count to
 *   the IPM layer's `COD_DANE` (515/387/563/709 manzanas per municipio,
 *   matching exactly) — the same physical city blocks — so this indicator
 *   fetches attributes-only from layer 808 and joins them onto the IPM
 *   layer's polygons by manzana code, rather than going geometry-less.
 *
 * Both datasets are static (2018 census / 2020-vintage IPM), so responses
 * are cached long — same `next: { revalidate }` convention as every other
 * ArcGIS fetch in this app (e.g. lib/inundaciones/streams.ts).
 */

const BASE_URL = "https://geoportal.dane.gov.co/mparcgis/rest/services"
const IPM_LAYER_URL = `${BASE_URL}/POBREZA_MULTIDIMENSIONAL/Serv_MGN2020_Integrado_IPM/FeatureServer/325`
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

/** Reverse lookup (code → name) for enriching manzana-level features, which carry no name field of their own. */
const MUNICIPIO_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STUDY_MUNICIPIO_CODES).map(([name, code]) => [code, name]),
)

export interface PobrezaFeature {
  type: "Feature"
  properties: {
    municipio: string
    codigoMunicipio: string
    codigoManzana: string
    /** % of the manzana's population in multidimensional poverty (DANE IPM, MGN2020-integrated). */
    ipm: number
    /** DANE's own pre-bucketed label, e.g. "Vulnerabilidad media-alta". */
    categoria: string
  }
  geometry: GeoJSON.Geometry
}

export interface PobrezaFeatureCollection {
  type: "FeatureCollection"
  features: PobrezaFeature[]
}

/**
 * Manzana-level multidimensional poverty index polygons for the 4 study
 * municipios — the finest resolution DANE publishes for this indicator.
 * Paginated: ~2,174 manzanas across the 4 municipios exceeds the service's
 * 2,000-record page size (same shape as `getViviendasHogaresPersonas`).
 */
export async function getPobrezaMultidimensional(): Promise<PobrezaFeatureCollection> {
  const pageSize = 2000
  const features: PobrezaFeature[] = []
  let offset = 0

  while (true) {
    const params = new URLSearchParams({
      where: `COD_MPIO IN (${CODES_IN_LIST})`,
      outFields: "COD_MPIO,COD_DANE,ipm,LABEL",
      outSR: "4326",
      resultRecordCount: String(pageSize),
      resultOffset: String(offset),
      f: "geojson",
    })
    const res = await fetch(`${IPM_LAYER_URL}/query?${params}`, { next: { revalidate: REVALIDATE_SECONDS } })
    if (!res.ok) {
      throw new Error(`DANE IPM query failed (${res.status})`)
    }
    const page = (await res.json()) as {
      features: { type: "Feature"; properties: Record<string, unknown>; geometry: GeoJSON.Geometry }[]
    }
    for (const f of page.features) {
      const codigoMunicipio = String(f.properties.COD_MPIO ?? "")
      features.push({
        type: "Feature",
        properties: {
          municipio: MUNICIPIO_NAME_BY_CODE[codigoMunicipio] ?? codigoMunicipio,
          codigoMunicipio,
          codigoManzana: String(f.properties.COD_DANE ?? ""),
          ipm: Number(f.properties.ipm ?? 0),
          categoria: String(f.properties.LABEL ?? ""),
        },
        geometry: f.geometry,
      })
    }
    if (page.features.length < pageSize) break
    offset += pageSize
  }

  return { type: "FeatureCollection", features }
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

interface CensusCounts {
  viviendas: number
  hogares: number
  personas: number
}

/**
 * Attribute-only pull of viviendas/hogares/personas from layer 808, keyed
 * by manzana code — no geometry requested since this layer's query
 * endpoint never returns any (see module docstring). Joined onto the IPM
 * layer's polygons in `getViviendasHogaresPersonas`.
 */
async function fetchManzanaCensusCounts(): Promise<Map<string, CensusCounts>> {
  const pageSize = 2000
  const byCode = new Map<string, CensusCounts>()
  let offset = 0

  while (true) {
    const params = new URLSearchParams({
      where: `MPIO_CDPMP IN (${CODES_IN_LIST})`,
      outFields: "COD_DANE_A,TVIVIENDA,TP16_HOG,TP27_PERSO",
      resultRecordCount: String(pageSize),
      resultOffset: String(offset),
      f: "json",
    })
    const res = await fetch(`${MANZANA_LAYER_URL}/query?${params}`, { next: { revalidate: REVALIDATE_SECONDS } })
    if (!res.ok) {
      throw new Error(`DANE manzana census query failed (${res.status})`)
    }
    const page = (await res.json()) as { features: { attributes: Record<string, unknown> }[] }
    for (const f of page.features) {
      byCode.set(String(f.attributes.COD_DANE_A ?? ""), {
        viviendas: Number(f.attributes.TVIVIENDA ?? 0),
        hogares: Number(f.attributes.TP16_HOG ?? 0),
        personas: Number(f.attributes.TP27_PERSO ?? 0),
      })
    }
    if (page.features.length < pageSize) break
    offset += pageSize
  }

  return byCode
}

/**
 * City-block ("manzana") level viviendas/hogares/personas counts for the 4
 * study municipios, from the 2018 census (matches the estadisticas-integradas
 * geovisor, cod_dimension=1). Layer 808 carries the counts but never returns
 * geometry, so each manzana's polygon is borrowed from the IPM layer
 * (`getPobrezaMultidimensional`) and joined by manzana code — see the
 * module docstring for why this join is safe (identical codes, identical
 * per-municipio counts).
 */
export async function getViviendasHogaresPersonas(): Promise<ManzanaFeatureCollection> {
  const [pobreza, censusByCode] = await Promise.all([getPobrezaMultidimensional(), fetchManzanaCensusCounts()])

  const features: ManzanaFeature[] = pobreza.features.map((f) => {
    const census = censusByCode.get(f.properties.codigoManzana)
    return {
      type: "Feature",
      properties: {
        codigoMunicipio: f.properties.codigoMunicipio,
        codigoManzana: f.properties.codigoManzana,
        viviendas: census?.viviendas ?? 0,
        hogares: census?.hogares ?? 0,
        personas: census?.personas ?? 0,
      },
      geometry: f.geometry,
    }
  })

  return { type: "FeatureCollection", features }
}
