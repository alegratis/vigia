import 'server-only'

export interface UpstreamSource {
  id: string
  nombre: string
  /** Qué deja de funcionar si esta fuente cae. */
  afecta: string
  url: string
  /** Clave de withSnapshot que guarda su última versión buena, si la tiene. */
  snapshotKey?: string
}

const USER_AGENT = 'Mozilla/5.0 (compatible; VIGIA-RiskDashboard/1.0; +https://vigia.vercel.app)'
const PROBE_TIMEOUT_MS = 6_000

export const UPSTREAM_SOURCES: UpstreamSource[] = [
  {
    id: 'esri-veredas',
    nombre: 'Esri Colombia, veredas rurales',
    afecta: 'Límites de veredas, riesgo compuesto, API v1 y alertas',
    url: 'https://ags.esri.co/arcgis/rest/services/DatosAbiertos/VEREDAS_2016/MapServer/0?f=json',
    snapshotKey: 'veredas:rurales',
  },
  {
    id: 'arcgis-zona-urbana',
    nombre: 'ArcGIS Online, zona urbana MGN 2025',
    afecta: 'Casco Urbano de cada municipio (fuente principal)',
    url: 'https://services7.arcgis.com/oJtolNh5k8HxCVtB/arcgis/rest/services/MGN2025_Zona_Urbana_simplificado/FeatureServer/0?f=json',
    snapshotKey: 'veredas:cascos-urbanos',
  },
  {
    id: 'dane-zona-urbana',
    nombre: 'DANE, zona urbana (portalgis)',
    afecta: 'Casco Urbano de cada municipio (alternativa oficial)',
    url: 'https://portalgis.dane.gov.co/mparcgis/rest/services/Hosted/Serv_ZonaUrbana_MGN_2025/FeatureServer/1?f=json',
  },
  {
    id: 'dane-geoportal',
    nombre: 'DANE, geoportal',
    afecta: 'Demografía, pobreza multidimensional y vulnerabilidad social',
    url: 'https://geoportal.dane.gov.co/mparcgis/rest/services?f=json',
    snapshotKey: 'dane:pobreza-multidimensional',
  },
  {
    id: 'overpass',
    nombre: 'OpenStreetMap, Overpass',
    afecta: 'Infraestructura por categoría',
    url: 'https://overpass-api.de/api/status',
    snapshotKey: 'osm:infraestructura',
  },
  {
    id: 'sgc-vivo',
    nombre: 'SGC, sismos en vivo',
    afecta: 'Sismología y alertas de sismos',
    url: 'https://archive.sgc.gov.co/feed/v1.0.1/summary/five_days_all.json',
  },
  {
    id: 'usgs',
    nombre: 'USGS, sismos',
    afecta: 'Sismología y alertas de sismos',
    url: 'https://earthquake.usgs.gov/fdsnws/event/1/version',
  },
  {
    id: 'open-meteo',
    nombre: 'Open-Meteo',
    afecta: 'Clima, precipitación, deslizamientos e incendios',
    url: 'https://api.open-meteo.com/v1/forecast?latitude=4.27&longitude=-75.94&hourly=temperature_2m&forecast_days=1',
  },
  {
    id: 'arcgis-amenazas',
    nombre: 'ArcGIS, amenazas de Vigía',
    afecta: 'Deslizamientos, inundaciones e incendios',
    url: 'https://services8.arcgis.com/UYEK9SUzH1am9mbk/arcgis/rest/services?f=json',
  },
  {
    id: 'arcgis-sgc',
    nombre: 'ArcGIS, SGC (fallas e inventario)',
    afecta: 'Fallas geológicas e inventario de movimientos en masa',
    url: 'https://services1.arcgis.com/Og2nrTKe5bptW02d/arcgis/rest/services?f=json',
  },
  {
    id: 'geoglows',
    nombre: 'GEOGLOWS, caudales',
    afecta: 'Inundaciones y estaciones de río',
    url: 'https://livefeeds3.arcgis.com/arcgis/rest/services?f=json',
  },
  {
    id: 'ideam',
    nombre: 'IDEAM, datos abiertos',
    afecta: 'Precipitación observada',
    url: 'https://www.datos.gov.co/resource/s54a-sgyg.json?$limit=1',
  },
  {
    id: 'valle-infraestructura',
    nombre: 'Gobernación del Valle, infraestructura',
    afecta: 'Sitios críticos de deslizamientos',
    url: 'https://infraestructura.valledelcauca.gov.co/server/rest/services?f=json',
  },
]

export interface ProbeResult {
  id: string
  alcanzable: boolean
  httpStatus: number | null
  latenciaMs: number
  error: string | null
}

/** Una fuente cuenta como alcanzable si responde cualquier código HTTP por debajo de 500. */
export async function probeSource(source: UpstreamSource): Promise<ProbeResult> {
  const started = Date.now()
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    })
    await res.body?.cancel()
    return {
      id: source.id,
      alcanzable: res.status < 500,
      httpStatus: res.status,
      latenciaMs: Date.now() - started,
      error: res.status < 500 ? null : `HTTP ${res.status}`,
    }
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null
    const message = error instanceof Error ? error.message : String(error)
    return {
      id: source.id,
      alcanzable: false,
      httpStatus: null,
      latenciaMs: Date.now() - started,
      error: (cause ?? message).slice(0, 160),
    }
  }
}

export function probeAll(): Promise<ProbeResult[]> {
  return Promise.all(UPSTREAM_SOURCES.map(probeSource))
}
