/**
 * Merges manually-provided, authoritative polygon data for educational and
 * health institutions into sitios-sensibles.geojson, replacing the
 * OSM-derived "educacion" and "salud" features (sourced from Overpass via
 * fetch-sensitive-sites.mjs, which is often incomplete or outdated for these
 * categories). "gobierno" features are left untouched since they still come
 * from OSM.
 *
 * Source files (provided by the user, real building footprints — not OSM):
 *   public/data/hidrantes/instituciones_educativas.geojson
 *   public/data/hidrantes/instituciones_de_salud.geojson
 *
 * Re-run this script whenever those source files are updated:
 *
 *   node scripts/merge-manual-sensitive-sites.mjs
 */

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const DATA_DIR = path.join(process.cwd(), "public", "data", "hidrantes")

async function readJson(file) {
  const raw = await readFile(path.join(DATA_DIR, file), "utf8")
  return JSON.parse(raw)
}

// The source files repeat the same institution across several disjoint
// polygons (e.g. separate buildings on one campus) and include blank
// placeholder features. Group by name and keep only the largest polygon per
// name so each institution renders once, and drop features with no name or
// no coordinates.
function dedupeByName(features) {
  const byName = new Map()
  for (const f of features) {
    const name = f.properties?.Nombre?.trim()
    const coords = f.geometry?.coordinates
    if (!name || !coords || coords.length === 0) continue

    const ring = f.geometry.type === "MultiPolygon" ? coords[0][0] : coords[0]
    const area = Math.abs(ringArea(ring))

    const existing = byName.get(name)
    if (!existing || area > existing.area) {
      byName.set(name, { feature: f, area })
    }
  }
  return [...byName.values()].map(({ feature }) => feature)
}

// Shoelace formula on raw lon/lat — only used to compare relative sizes, not
// for an accurate area in square meters.
function ringArea(ring) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

function toSitioSensible(feature, category) {
  return {
    type: "Feature",
    properties: { category, name: feature.properties.Nombre.trim() },
    geometry: feature.geometry,
  }
}

async function main() {
  const [educacionRaw, saludRaw, existing] = await Promise.all([
    readJson("instituciones_educativas.geojson"),
    readJson("instituciones_de_salud.geojson"),
    readJson("sitios-sensibles.geojson"),
  ])

  const educacion = dedupeByName(educacionRaw.features).map((f) => toSitioSensible(f, "educacion"))
  const salud = dedupeByName(saludRaw.features).map((f) => toSitioSensible(f, "salud"))
  const gobierno = existing.features.filter((f) => f.properties.category === "gobierno")

  const features = [...educacion, ...salud, ...gobierno]
  const geojson = { type: "FeatureCollection", features }

  const outPath = path.join(DATA_DIR, "sitios-sensibles.geojson")
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
