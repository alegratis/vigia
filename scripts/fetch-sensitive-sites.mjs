/**
 * One-off fetch of "sitios sensibles" (sensitive sites) — schools/universities,
 * hospitals, and government/public buildings — around Sevilla's casco urbano
 * from OpenStreetMap's Overpass API, saved as a static GeoJSON file.
 *
 * This data changes rarely enough that querying Overpass on every request
 * isn't worth it (same reasoning as hidrantes-sevilla.geojson, also static).
 * Re-run this script manually if the set of nearby institutions changes:
 *
 *   node scripts/fetch-sensitive-sites.mjs
 */

import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import booleanPointInPolygon from "@turf/boolean-point-in-polygon"
import distance from "@turf/distance"
import buffer from "@turf/buffer"
import { point } from "@turf/helpers"

// OSM doesn't always carry a building footprint for a given institution (the
// query only returns a POI node). The app never wants to render these as
// points — they'd be indistinguishable from hydrant markers — so we
// approximate the footprint with a small polygon around the point instead.
// This is not the real building/manzana outline, just enough to read as "a
// place on the map" rather than "a dot like a hydrant".
const APPROXIMATE_FOOTPRINT_RADIUS_M = 35

// Sevilla casco urbano bounds (lib/demografia/geo-detect.ts's
// SEVILLA_CASCO_URBANO_BOUNDS) padded by ~3km so institutions just outside
// the casco urbano that still shape nearby hydrants' coverage aren't missed.
const WEST = -75.945 - 0.03
const SOUTH = 4.252 - 0.03
const EAST = -75.918 + 0.03
const NORTH = 4.287 + 0.03
const BBOX = `${SOUTH},${WEST},${NORTH},${EAST}`

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
]

const QUERY = `
  [out:json][timeout:25];
  (
    nwr["amenity"~"^(school|university|college|kindergarten|childcare)$"](${BBOX});
    nwr["amenity"~"^(hospital|clinic)$"](${BBOX});
    nwr["amenity"~"^(townhall|courthouse|public_building)$"](${BBOX});
    nwr["office"="government"](${BBOX});
    nwr["building"~"^(school|university|college|kindergarten)$"](${BBOX});
    nwr["building"="hospital"](${BBOX});
    nwr["healthcare"~"^(hospital|clinic)$"](${BBOX});
  );
  out geom;
`.trim()

// Ruins / historic monuments sometimes carry a building=hospital or
// building=school tag even though the site is no longer in use — skip those
// so the layer only highlights active institutions.
function isActive(tags) {
  return !tags.historic && !tags.disused && !tags.abandoned
}

function classify(tags) {
  if (!isActive(tags)) return null

  const amenity = tags.amenity
  const building = tags.building
  if (
    amenity === "school" ||
    amenity === "university" ||
    amenity === "college" ||
    amenity === "kindergarten" ||
    amenity === "childcare" ||
    building === "school" ||
    building === "university" ||
    building === "college" ||
    building === "kindergarten"
  ) {
    return "educacion"
  }
  if (amenity === "hospital" || amenity === "clinic" || building === "hospital" || tags.healthcare === "hospital" || tags.healthcare === "clinic") {
    return "salud"
  }
  if (amenity === "townhall" || amenity === "courthouse" || amenity === "public_building" || tags.office === "government") {
    return "gobierno"
  }
  return null
}

function elementToFeature(el) {
  const tags = el.tags
  if (!tags) return null
  const category = classify(tags)
  if (!category) return null

  const name = tags.name ?? null

  if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
    return {
      type: "Feature",
      properties: { category, name },
      geometry: { type: "Point", coordinates: [el.lon, el.lat] },
    }
  }

  if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 3) {
    const coords = el.geometry.filter((g) => g != null).map((g) => [g.lon, g.lat])
    // Close the ring if Overpass didn't repeat the first vertex.
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) coords.push(first)
    if (coords.length < 4) return null
    return {
      type: "Feature",
      properties: { category, name },
      geometry: { type: "Polygon", coordinates: [coords] },
    }
  }

  // Relations (multipolygons) and ways without full geometry: fall back to
  // the element's bounding-box center so the site is still represented.
  if (el.bounds) {
    const { minlat, minlon, maxlat, maxlon } = el.bounds
    return {
      type: "Feature",
      properties: { category, name },
      geometry: { type: "Point", coordinates: [(minlon + maxlon) / 2, (minlat + maxlat) / 2] },
    }
  }

  return null
}

async function queryMirror(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "VIGIA-RiskDashboard/1.0 (+https://vigia.vercel.app)",
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  })
  if (!res.ok) throw new Error(`Overpass respondió ${res.status} desde ${url}`)
  return res.json()
}

async function main() {
  let json
  let lastError
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`Consultando ${url}…`)
      json = await queryMirror(url)
      break
    } catch (err) {
      lastError = err
      console.warn(`  falló: ${err.message}`)
    }
  }
  if (!json) throw lastError ?? new Error("No se pudo consultar ningún mirror de Overpass")

  const rawFeatures = []
  const seen = new Set()
  for (const el of json.elements) {
    const feature = elementToFeature(el)
    if (!feature) continue
    const key = `${el.type}/${el.id}`
    if (seen.has(key)) continue
    seen.add(key)
    rawFeatures.push(feature)
  }

  // OSM frequently tags the same institution twice: a POI node (often the
  // entrance or a label point) plus a separate building way/relation for its
  // footprint. Both match our query and would otherwise render as a
  // duplicate dot sitting right on top of (or next to) the polygon. Drop any
  // Point feature that falls inside, or within DUPLICATE_RADIUS_M of, a
  // Polygon/MultiPolygon feature so each institution renders once — as its
  // building footprint when we have one, falling back to a dot only when we
  // don't.
  const DUPLICATE_RADIUS_M = 40
  const polygons = rawFeatures.filter(
    (f) => f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon",
  )
  const dedupedFeatures = rawFeatures.filter((f) => {
    if (f.geometry.type !== "Point") return true
    const pt = point(f.geometry.coordinates)
    return !polygons.some((poly) => {
      if (booleanPointInPolygon(pt, poly.geometry)) return true
      const [lon, lat] = poly.geometry.type === "Polygon" ? poly.geometry.coordinates[0][0] : poly.geometry.coordinates[0][0][0]
      return distance(pt, point([lon, lat]), { units: "meters" }) < DUPLICATE_RADIUS_M
    })
  })

  // The app never wants bare points for buildings (they'd be
  // indistinguishable from hydrant markers), so any site OSM only gave us as
  // a node — no building footprint, no bounds fallback — gets an
  // approximate footprint polygon instead.
  const features = dedupedFeatures.map((f) => {
    if (f.geometry.type !== "Point") return f
    const footprint = buffer(point(f.geometry.coordinates), APPROXIMATE_FOOTPRINT_RADIUS_M, {
      units: "meters",
      steps: 16,
    })
    if (!footprint) return f
    footprint.properties = f.properties
    return footprint
  })

  const geojson = { type: "FeatureCollection", features }

  const outDir = path.join(process.cwd(), "public", "data", "hidrantes")
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, "sitios-sensibles.geojson")
  await writeFile(outPath, JSON.stringify(geojson))

  const counts = features.reduce((acc, f) => {
    acc[f.properties.category] = (acc[f.properties.category] ?? 0) + 1
    return acc
  }, {})
  console.log(`Guardado ${features.length} sitios en ${outPath}`)
  console.log(counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
