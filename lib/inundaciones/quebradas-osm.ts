/**
 * Supplemental stream trace(s) not present in the ArcGIS "Quebradas" layer
 * (see streams.ts), sourced from OpenStreetMap instead.
 *
 * "Quebrada San José" was requested for the map's stream/river line layer
 * (see the Quebradas map route below), but it isn't one of the ArcGIS
 * layer's 19 named traces. OSM has it under `waterway=stream` — verified
 * via Overpass (query: `way["waterway"]["name"~"San José",i]` within the
 * study-area bbox) against two independent checks: (1) its 17 way segments
 * cluster tightly around 4.263°N, -75.926°W (~400m across), not scattered
 * city-wide the way a common name colliding across unrelated streams
 * would; (2) reverse-geocoding that centroid resolves to "Barrio San
 * José, Sevilla" — the stream runs through the Sevilla neighborhood it's
 * named after. A second, unrelated OSM way also named "Quebrada San José"
 * exists ~30km north (4.537°N, -75.696°W) and is deliberately excluded
 * here — outside the study area and not the one asked about.
 *
 * Static hydrography, same reasoning as the ArcGIS traces in streams.ts:
 * safe to hardcode rather than re-fetch from Overpass on every request.
 */

export const QUEBRADA_SAN_JOSE_OSM = {
  nombre: "Quebrada San José",
  /** No GEOGLOWS reach id — this trace isn't in the ArcGIS layer that carries one. */
  rivid: null as number | null,
  /** 17 disjoint OSM way segments, each a `[lon, lat]` vertex list, as digitized in OSM. */
  paths: [
    [
      [-75.923867, 4.262055],
      [-75.923867, 4.262048],
      [-75.923914, 4.261894],
      [-75.924014, 4.261931],
      [-75.924095, 4.261837],
      [-75.924182, 4.261822],
      [-75.924291, 4.261955],
      [-75.924385, 4.261967],
      [-75.924584, 4.261776],
      [-75.925052, 4.261562],
    ],
    [
      [-75.918445, 4.26506],
      [-75.918449, 4.265059],
      [-75.919258, 4.265096],
      [-75.919563, 4.265222],
      [-75.919802, 4.265225],
      [-75.91996, 4.265111],
      [-75.920178, 4.264849],
      [-75.920553, 4.26483],
      [-75.92085, 4.264679],
      [-75.921237, 4.264593],
      [-75.921308, 4.264514],
      [-75.921316, 4.264341],
    ],
    [
      [-75.921788, 4.26375],
      [-75.92179, 4.263749],
      [-75.922019, 4.263743],
      [-75.922357, 4.263854],
      [-75.922719, 4.263783],
      [-75.922975, 4.263641],
      [-75.923332, 4.263269],
      [-75.923431, 4.263067],
      [-75.923592, 4.263032],
      [-75.923672, 4.262967],
      [-75.923676, 4.26269],
      [-75.923864, 4.26254],
      [-75.923913, 4.26242],
      [-75.923924, 4.262256],
      [-75.923867, 4.262055],
    ],
    [
      [-75.928988, 4.263313],
      [-75.92923, 4.263374],
      [-75.929443, 4.263573],
      [-75.929529, 4.263866],
      [-75.92962, 4.264011],
      [-75.929722, 4.264203],
      [-75.92984, 4.264332],
      [-75.930017, 4.264621],
      [-75.930237, 4.264803],
      [-75.930312, 4.264899],
      [-75.930489, 4.264851],
      [-75.930971, 4.264872],
      [-75.931138, 4.265145],
      [-75.931041, 4.265241],
      [-75.931004, 4.265771],
      [-75.930939, 4.266392],
      [-75.930896, 4.266648],
      [-75.930988, 4.266771],
      [-75.931149, 4.26682],
      [-75.931535, 4.26698],
      [-75.931975, 4.267023],
      [-75.93293, 4.266975],
      [-75.93296, 4.266979],
    ],
    [
      [-75.926734, 4.26341],
      [-75.926804, 4.263416],
    ],
    [
      [-75.925841, 4.262504],
      [-75.925877, 4.262517],
      [-75.925903, 4.262519],
    ],
    [
      [-75.925903, 4.262519],
      [-75.925906, 4.262519],
      [-75.925959, 4.26259],
      [-75.926291, 4.262598],
    ],
    [
      [-75.926313, 4.262772],
      [-75.926396, 4.263138],
      [-75.926626, 4.263342],
    ],
    [
      [-75.928274, 4.263277],
      [-75.928351, 4.263235],
    ],
    [
      [-75.927605, 4.263497],
      [-75.927972, 4.263505],
      [-75.928274, 4.263277],
    ],
    [
      [-75.925052, 4.261562],
      [-75.925297, 4.261703],
      [-75.925805, 4.262315],
      [-75.925841, 4.262504],
    ],
    [
      [-75.921316, 4.264341],
      [-75.921317, 4.264335],
      [-75.921435, 4.264138],
      [-75.921661, 4.26399],
      [-75.921788, 4.26375],
    ],
    [
      [-75.927503, 4.26349],
      [-75.927605, 4.263497],
    ],
    [
      [-75.928455, 4.263242],
      [-75.928988, 4.263313],
    ],
    [
      [-75.928351, 4.263235],
      [-75.928455, 4.263242],
    ],
    [
      [-75.926291, 4.262598],
      [-75.926313, 4.262772],
    ],
    [
      [-75.926804, 4.263416],
      [-75.927503, 4.26349],
    ],
  ] as Array<Array<[number, number]>>,
}
