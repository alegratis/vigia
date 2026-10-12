import "server-only"

import { AOI_BOUNDS } from "@/lib/geoglows/live-map"
import { getStreamTraces } from "@/lib/inundaciones/streams"
import type { GeoglowsReachFeatureCollection, GeoglowsReachProperties } from "@/lib/geoglows/reaches-types"

/**
 * Every GEOGLOWS river reach inside the study area, as vector lines, from the
 * same live ArcGIS feed the flood section already used (see live-map.ts) —
 * but queried as features instead of rendered as an image, so the map can
 * draw them and give each one a wide, forgiving hit area.
 *
 * GEOGLOWS publishes reaches by numeric id only. Names come from the
 * "Quebradas" layer (streams.ts), whose `rivid` is the same id scheme; the
 * reaches it doesn't cover stay unnamed rather than being given a guessed one.
 */

const LAYER_QUERY =
  "https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer/0/query"

interface RawProperties {
  comid: number
  streamorder: number | null
  meanflow: number | null
  returnperiod: number | null
  timevalue: number | null
}

async function getNamesByReach(): Promise<Map<number, string>> {
  try {
    const traces = await getStreamTraces()
    const grouped = new Map<number, string[]>()
    for (const trace of traces) {
      if (trace.rivid == null || !trace.nombre) continue
      const names = grouped.get(trace.rivid) ?? []
      if (!names.includes(trace.nombre)) names.push(trace.nombre)
      grouped.set(trace.rivid, names)
    }
    return new Map([...grouped].map(([id, names]) => [id, names.join(" / ")]))
  } catch {
    return new Map()
  }
}

export async function getAoiReaches(): Promise<GeoglowsReachFeatureCollection> {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: `${AOI_BOUNDS.west},${AOI_BOUNDS.south},${AOI_BOUNDS.east},${AOI_BOUNDS.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    outFields: "comid,streamorder,meanflow,returnperiod,timevalue",
    maxAllowableOffset: "0.0002",
    geometryPrecision: "5",
    f: "geojson",
  })

  const [res, names] = await Promise.all([
    fetch(`${LAYER_QUERY}?${params.toString()}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Vigia/1.0)" },
      next: { revalidate: 3600 },
    }),
    getNamesByReach(),
  ])
  if (!res.ok) throw new Error("No se pudo consultar los tramos de río de GEOGLOWS")

  const json = (await res.json()) as GeoJSON.FeatureCollection<
    GeoJSON.LineString | GeoJSON.MultiLineString,
    RawProperties
  >

  return {
    type: "FeatureCollection",
    features: (json.features ?? []).map((feature) => {
      const p = feature.properties
      const properties: GeoglowsReachProperties = {
        comid: p.comid,
        nombre: names.get(p.comid) ?? null,
        streamorder: p.streamorder ?? 2,
        meanflow: p.meanflow ?? null,
        returnperiod: p.returnperiod ?? 0,
        forecastAt: p.timevalue ? new Date(p.timevalue).toISOString() : null,
      }
      return { type: "Feature", geometry: feature.geometry, properties }
    }),
  }
}
