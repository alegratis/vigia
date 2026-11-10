import "server-only"

import { arcgisToGeoJSON } from "@terraformer/arcgis"
import { MUNICIPIOS } from "@/lib/alertas/municipios"
import { withSnapshot } from "@/lib/upstream/resilient"
import cascosUrbanosRespaldo from "./data/cascos-urbanos.json"
import { normalizeVeredaNombre } from "./name-corrections"

/**
 * Fetches vereda (sub-municipal) administrative boundaries for the study
 * area — Caicedonia, Sevilla, Zarzal and Roldanillo — from two ArcGIS REST
 * sources:
 *
 * - Esri Colombia's "Veredas de Colombia" Datos Abiertos layer
 *   (ags.esri.co) for the rural veredas themselves. This replaced an
 *   earlier version of this module that decoded DANE's raw vector tiles
 *   (geoportal.dane.gov.co/geovisores/territorio/nivel-referencia-veredas)
 *   directly — that tile pyramid's hardcoded x/y range silently clipped
 *   several of Sevilla's easternmost veredas (Maulen, Mira Flores, Peñas
 *   Blancas, San Juan, Tibi) because it was hand-derived from an
 *   approximate bbox rather than the municipio's true extent.
 * - DANE's MGN "Zona Urbana" layer (portalgis.dane.gov.co) for each
 *   municipio's cabecera municipal, filtered to `clas_ccdgo === "1"`
 *   (as opposed to `"2"`, smaller centros poblados/corregimientos) and
 *   surfaced as a synthetic "Casco Urbano" boundary per municipio — the
 *   rural veredas layer has no concept of the urban core at all, so
 *   without this the exposure picker can't represent it.
 *
 * Esri's polygon rings (clockwise outer / counter-clockwise hole, all
 * flattened into one `rings` array) are converted to nested GeoJSON
 * Polygon/MultiPolygon coordinates with @terraformer/arcgis rather than by
 * hand, since correctly re-grouping holes under their outer ring from
 * ring orientation alone is easy to get subtly wrong.
 */

const VEREDAS_QUERY_URL = "https://ags.esri.co/arcgis/rest/services/DatosAbiertos/VEREDAS_2016/MapServer/0/query"

/**
 * Zona urbana del MGN, en orden de preferencia. El servicio oficial del DANE
 * suele ser inalcanzable desde fuera de Colombia (incluida la infraestructura
 * de Vercel), así que se prueba primero el espejo de ArcGIS Online con el mismo
 * dato de 2025 simplificado, luego el DANE y, por último, el MGN 2024 completo.
 * Las tres capas comparten los campos mpio_cdpmp, clas_ccdgo y zu_cnmbre.
 */
const ZONA_URBANA_SOURCES = [
  {
    id: "arcgis-online-2025",
    url: "https://services7.arcgis.com/oJtolNh5k8HxCVtB/arcgis/rest/services/MGN2025_Zona_Urbana_simplificado/FeatureServer/0/query",
  },
  {
    id: "dane-portalgis-2025",
    url: "https://portalgis.dane.gov.co/mparcgis/rest/services/Hosted/Serv_ZonaUrbana_MGN_2025/FeatureServer/1/query",
  },
  {
    id: "arcgis-online-2024",
    url: "https://services.arcgis.com/deQSb0Gn7gDPf3uV/arcgis/rest/services/MGN2024_URB_ZONA_URBANA/FeatureServer/0/query",
  },
] as const

/** DIVIPOLA municipio codes for the study area: Caicedonia, Sevilla, Zarzal, Roldanillo. */
const MUNICIPIO_CODES = ["76122", "76736", "76895", "76622"]

// Static admin boundaries change essentially never — cache both sources a week.
const REVALIDATE_SECONDS = 604800

function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

/** Flattens a decoded GeoJSON Polygon/MultiPolygon into this module's flat MultiPolygon ring-set shape. */
function toPolygons(geometry: { type: string; coordinates: unknown }): number[][][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]]
  if (geometry.type === "MultiPolygon") return geometry.coordinates as number[][][][]
  return []
}

export interface VeredaBoundary {
  codigoVereda: string
  nombre: string
  municipio: string
  /**
   * True for the municipio's cabecera municipal ("Casco Urbano") pseudo-vereda,
   * sourced from DANE's zona urbana layer rather than the rural veredas layer.
   */
  esCascoUrbano?: boolean
  /** MultiPolygon coordinate rings, `[lon, lat]` order. */
  polygons: number[][][][]
}

interface EsriFeature {
  attributes: Record<string, string>
  geometry?: { rings: number[][][] }
}

async function queryArcgis(url: string, where: string, outFields: string, timeoutMs: number): Promise<EsriFeature[]> {
  const params = new URLSearchParams({
    where,
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  })
  // `no-store`: la respuesta rural pesa más de 2 MB y Next no la puede guardar en su
  // caché de fetch; el caché real lo hace withSnapshot (memoria + Supabase).
  const res = await fetch(`${url}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`ArcGIS query failed (${res.status}): ${url}`)
  const data = await res.json()
  if (data.error) throw new Error(`ArcGIS query error: ${data.error.message ?? JSON.stringify(data.error)}`)
  return data.features ?? []
}

async function fetchVeredasRurales(): Promise<VeredaBoundary[]> {
  const where = `DPTOMPIO IN (${MUNICIPIO_CODES.map((c) => `'${c}'`).join(",")})`
  const features = await queryArcgis(VEREDAS_QUERY_URL, where, "NOMBRE_VER,NOMB_MPIO,CODIGO_VER,DPTOMPIO", 20_000)

  return features
    .filter((f) => f.geometry)
    .map((f) => {
      const geo = arcgisToGeoJSON({ geometry: f.geometry!, attributes: f.attributes }) as {
        geometry: { type: string; coordinates: unknown }
      }
      return {
        codigoVereda: f.attributes.CODIGO_VER,
        nombre: normalizeVeredaNombre(f.attributes.NOMBRE_VER ?? ""),
        municipio: toTitleCase(f.attributes.NOMB_MPIO ?? ""),
        polygons: toPolygons(geo.geometry),
      }
    })
}

async function fetchCascosUrbanos(): Promise<VeredaBoundary[]> {
  // DANE's WAF 500s on a `where` clause combining the IN(...) list with an
  // `clas_ccdgo = '1'` equality check (false-positive injection filter) —
  // fetch every zona urbana feature for the study area's municipios instead
  // and filter to class 1 ("Cabecera municipal", as opposed to 2 "Centro
  // Poblado") client-side.
  const where = `mpio_cdpmp IN (${MUNICIPIO_CODES.map((c) => `'${c}'`).join(",")})`
  const failures: string[] = []

  for (const source of ZONA_URBANA_SOURCES) {
    try {
      const features = await queryArcgis(source.url, where, "mpio_cdpmp,zu_cnmbre,clas_ccdgo", 7_000)
      const cascos = features
        .filter((f) => f.geometry && String(f.attributes.clas_ccdgo) === "1")
        .map((f) => ({
          codigoVereda: `${f.attributes.mpio_cdpmp}-urbano`,
          nombre: "Casco Urbano",
          municipio: MUNICIPIOS.find((m) => m.code === f.attributes.mpio_cdpmp)?.name ?? "",
          esCascoUrbano: true,
          polygons: toPolygons(
            (arcgisToGeoJSON({ geometry: f.geometry!, attributes: f.attributes }) as { geometry: { type: string; coordinates: unknown } })
              .geometry,
          ),
        }))
      // Una fuente que devuelve menos de las cuatro cabeceras está incompleta: se descarta.
      if (cascos.length < MUNICIPIO_CODES.length) {
        throw new Error(`solo ${cascos.length} de ${MUNICIPIO_CODES.length} cabeceras`)
      }
      return cascos
    } catch (error) {
      failures.push(`${source.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`Ninguna fuente de zona urbana respondió (${failures.join("; ")})`)
}

export const VEREDAS_RURALES_KEY = "veredas:rurales"
export const CASCOS_URBANOS_KEY = "veredas:cascos-urbanos"

/**
 * Fetches every rural vereda plus one "Casco Urbano" pseudo-vereda per
 * municipio for the study area.
 *
 * Las dos fuentes son independientes y cada una guarda su última versión buena
 * (withSnapshot). Los cascos urbanos tienen tres fuentes en vivo y, si todas
 * fallan y no hay copia guardada, usan el archivo estático versionado en
 * ./data/cascos-urbanos.json (MGN 2025): nunca desaparecen del mapa. En ese caso
 * el estado queda como "down" en el endpoint de salud.
 */
export async function getVeredaBoundaries(): Promise<VeredaBoundary[]> {
  const [veredas, cascosUrbanos] = await Promise.all([
    withSnapshot(VEREDAS_RURALES_KEY, fetchVeredasRurales, { ttlSeconds: REVALIDATE_SECONDS }),
    withSnapshot(CASCOS_URBANOS_KEY, fetchCascosUrbanos, {
      ttlSeconds: REVALIDATE_SECONDS,
      timeoutMs: 24_000,
      fallback: cascosUrbanosRespaldo as unknown as VeredaBoundary[],
    }),
  ])
  return [...veredas, ...cascosUrbanos]
}
