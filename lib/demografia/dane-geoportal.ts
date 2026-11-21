/**
 * Manzana-level demographics for the 4 study municipios, served from DANE's public shapefiles
 * (https://www.dane.gov.co/files/geoportal-provisional/index.html) instead of its ArcGIS REST
 * geoportal, which is unreliable. Backs the Demografía tab's two DANE indicators:
 *
 * - Pobreza multidimensional: `SHP_VULNRB_IPMxMZ.zip` — one polygon per manzana with `ipm`
 *   (% of the population in multidimensional poverty) and DANE's own `LABEL` bucket
 *   ("Vulnerabilidad baja/media/alta").
 * - Viviendas, hogares y personas: `SHP_MGN2018_INTGRD_MANZ.zip` — the 2018 census counts
 *   (`TVIVIENDA`, `TP16_HOG`, `TP27_PERSO`) on the same manzana codes.
 *
 * Both are 2018-census data and never change, so `scripts/dane/extract-manzanas.py` extracts the
 * 2,174 manzanas of the 4 municipios once into `data/manzanas-2018.json` (515 Sevilla, 387
 * Caicedonia, 563 Zarzal, 709 Roldanillo) and this module reads that file. No network call to DANE
 * happens at runtime; only the barrio lookup (Sevilla's SIRD layer) is remote, and it degrades to
 * `barrio: null`.
 */

import { matchManzanasToBarrios } from "@/lib/barrios/boundaries"
import { withSnapshot } from "@/lib/upstream/resilient"
import manzanasFile from "./data/manzanas-2018.json"

/** DIVIPOLA municipio codes (`MPIO_CCDGO`/`MPIO_CDPMP`, 5-digit dept+municipio) for the 4 study municipios. */
export const STUDY_MUNICIPIO_CODES = {
  Sevilla: "76736",
  Caicedonia: "76122",
  Zarzal: "76895",
  Roldanillo: "76622",
} as const

const BARRIO_REFRESH_SECONDS = 2_592_000 // 30 days

export interface PobrezaFeature {
  type: "Feature"
  properties: {
    municipio: string
    codigoMunicipio: string
    codigoManzana: string
    /** % of the manzana's population in multidimensional poverty (DANE IPM, 2018 census). */
    ipm: number
    /** DANE's own pre-bucketed label, e.g. "Vulnerabilidad media-alta". */
    categoria: string
    /** Name of the Sevilla barrio this manzana's centroid falls inside (point-in-polygon against `lib/barrios/boundaries.ts`), or `null` outside Sevilla or outside every mapped barrio. DANE's own manzana code is a cryptic cadastral id, not something to show a person. */
    barrio: string | null
  }
  geometry: GeoJSON.Geometry
}

export interface PobrezaFeatureCollection {
  type: "FeatureCollection"
  features: PobrezaFeature[]
}

export interface ManzanaFeature {
  type: "Feature"
  properties: {
    codigoMunicipio: string
    codigoManzana: string
    viviendas: number
    hogares: number
    personas: number
    /** Name of the Sevilla barrio this manzana falls inside, or `null` — see `PobrezaFeature`. */
    barrio: string | null
  }
  geometry: GeoJSON.Geometry
}

export interface ManzanaFeatureCollection {
  type: "FeatureCollection"
  features: ManzanaFeature[]
}

interface StoredManzana {
  properties: {
    municipio: string
    codigoMunicipio: string
    codigoManzana: string
    ipm: number
    categoria: string
    viviendas: number
    hogares: number
    personas: number
  }
  geometry: GeoJSON.Geometry
}

const MANZANAS = (manzanasFile as unknown as { features: StoredManzana[] }).features

/** `codigoManzana → barrio`, matched once and kept (memory + Supabase). Empty when the barrio layer is unreachable. */
function getManzanaBarrios(): Promise<Record<string, string | null>> {
  return withSnapshot("dane:manzana-barrio", loadManzanaBarrios, {
    ttlSeconds: BARRIO_REFRESH_SECONDS,
    timeoutMs: 30_000,
    fallback: {},
  })
}

async function loadManzanaBarrios(): Promise<Record<string, string | null>> {
  const matched = await matchManzanasToBarrios(MANZANAS)
  return Object.fromEntries(matched)
}

/**
 * Manzana-level multidimensional poverty polygons for the 4 study municipios — the finest
 * resolution DANE publishes for this indicator (2,174 city blocks).
 */
export async function getPobrezaMultidimensional(): Promise<PobrezaFeatureCollection> {
  const barrios = await getManzanaBarrios()
  return {
    type: "FeatureCollection",
    features: MANZANAS.map((m) => ({
      type: "Feature",
      properties: {
        municipio: m.properties.municipio,
        codigoMunicipio: m.properties.codigoMunicipio,
        codigoManzana: m.properties.codigoManzana,
        ipm: m.properties.ipm,
        categoria: m.properties.categoria,
        barrio: barrios[m.properties.codigoManzana] ?? null,
      },
      geometry: m.geometry,
    })),
  }
}

/** City-block viviendas/hogares/personas counts for the 4 study municipios, from the 2018 census. */
export async function getViviendasHogaresPersonas(): Promise<ManzanaFeatureCollection> {
  const barrios = await getManzanaBarrios()
  return {
    type: "FeatureCollection",
    features: MANZANAS.map((m) => ({
      type: "Feature",
      properties: {
        codigoMunicipio: m.properties.codigoMunicipio,
        codigoManzana: m.properties.codigoManzana,
        viviendas: m.properties.viviendas,
        hogares: m.properties.hogares,
        personas: m.properties.personas,
        barrio: barrios[m.properties.codigoManzana] ?? null,
      },
      geometry: m.geometry,
    })),
  }
}
