/**
 * Builds `lib/demografia/data/dane-manzanas-snapshot.json`, the local mirror
 * of the DANE manzana-level IPM polygons + 2018 census counts for the 4
 * study municipios. DANE's ArcGIS geoportal is intermittently unavailable
 * (HTTP 500 HTML pages, `{error}` bodies behind a 200, and sometimes empty
 * `features` behind a 200), so the app serves this snapshot whenever the
 * live service cannot produce a complete, count-validated result.
 *
 * Resumable: every successful page is checkpointed in /tmp/dane-snapshot.
 * Usage: node scripts/build-demografia-snapshot.mjs
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BASE = "https://geoportal.dane.gov.co/mparcgis/rest/services"
const IPM_URL = `${BASE}/POBREZA_MULTIDIMENSIONAL/Serv_MGN2020_Integrado_IPM/FeatureServer/325/query`
const CENSUS_URL = `${BASE}/MARCO_INTEGRADO/Serv_DatosCNPV2018_Integrados_MGN2018/MapServer/808/query`

const EXPECTED = { "76736": 515, "76122": 387, "76895": 563, "76622": 709 }
const PAGE = 100
const MAX_ATTEMPTS = 40
const CHECKPOINT_DIR = "/tmp/dane-snapshot"
mkdirSync(CHECKPOINT_DIR, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = encodeURIComponent

async function fetchValid(url, validate, arrayKey = "features") {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000), cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (res.ok && json && !json.error && Array.isArray(json[arrayKey]) && validate(json)) return json
    } catch {
      // network error / timeout / HTML body — retry
    }
    await sleep(Math.min(500 * attempt, 5000))
  }
  return null
}

async function objectIds(kind, code) {
  const file = join(CHECKPOINT_DIR, `ids-${kind}-${code}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
  const where = kind === "ipm" ? `COD_MPIO='${code}'` : `MPIO_CDPMP='${code}'`
  const base = kind === "ipm" ? IPM_URL : CENSUS_URL
  const json = await fetchValid(`${base}?where=${enc(where)}&returnIdsOnly=true&f=json`, () => true, "objectIds")
  const ids = json?.objectIds?.slice().sort((a, b) => a - b) ?? null
  if (ids) writeFileSync(file, JSON.stringify(ids))
  return ids
}

// DANE's FeatureServer rejects resultOffset > 0, so pages are addressed by
// OBJECTID ranges taken from the sorted id list for the municipio instead.
async function pagedPage(kind, code, ids, start) {
  const chunk = ids.slice(start, start + PAGE)
  const file = join(CHECKPOINT_DIR, `${kind}-${code}-${start}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"))
  const range = `OBJECTID>=${chunk[0]} AND OBJECTID<=${chunk[chunk.length - 1]}`
  const url =
    kind === "ipm"
      ? `${IPM_URL}?where=${enc(`${range} AND COD_MPIO='${code}'`)}&outFields=COD_MPIO,COD_DANE,ipm,LABEL&outSR=4326&geometryPrecision=6&maxAllowableOffset=0.00001&f=geojson`
      : `${CENSUS_URL}?where=${enc(`${range} AND MPIO_CDPMP='${code}'`)}&outFields=COD_DANE_A,TVIVIENDA,TP16_HOG,TP27_PERSO&returnGeometry=false&f=json`
  const json = await fetchValid(url, (j) => j.features.length === chunk.length)
  if (!json) return null
  writeFileSync(file, JSON.stringify(json))
  return json
}

const round = (n) => Math.round(n * 1e6) / 1e6
const roundCoords = (c) => (typeof c[0] === "number" ? c.map(round) : c.map(roundCoords))

const pobreza = []
const censo = {}

for (const [code, expected] of Object.entries(EXPECTED)) {
  for (const kind of ["ipm", "census"]) {
    const rows = new Map()
    const ids = await objectIds(kind, code)
    if (!ids || ids.length !== expected) {
      console.error(`FAILED ids ${kind} ${code}: got ${ids?.length ?? "none"} expected ${expected}`)
      process.exit(1)
    }
    for (let offset = 0; offset < expected; offset += PAGE) {
      const page = await pagedPage(kind, code, ids, offset)
      if (!page) {
        console.error(`FAILED ${kind} ${code} offset ${offset} after ${MAX_ATTEMPTS} attempts`)
        process.exit(1)
      }
      for (const f of page.features) {
        if (kind === "ipm") rows.set(String(f.properties.COD_DANE), f)
        else rows.set(String(f.attributes.COD_DANE_A), f)
      }
      process.stdout.write(`${kind} ${code} ${Math.min(offset + PAGE, expected)}/${expected}\n`)
    }
    if (rows.size !== expected) {
      console.error(`COUNT MISMATCH ${kind} ${code}: ${rows.size} unique vs ${expected} expected (paging overlap) — rerun after deleting ${CHECKPOINT_DIR}`)
      process.exit(1)
    }
    for (const [manzana, f] of rows) {
      if (kind === "ipm") {
        pobreza.push({
          c: code,
          m: manzana,
          ipm: Number(f.properties.ipm ?? 0),
          l: String(f.properties.LABEL ?? ""),
          g: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
        })
      } else {
        censo[manzana] = [Number(f.attributes.TVIVIENDA ?? 0), Number(f.attributes.TP16_HOG ?? 0), Number(f.attributes.TP27_PERSO ?? 0)]
      }
    }
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), "../lib/demografia/data/dane-manzanas-snapshot.json")
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ builtAt: new Date().toISOString(), expected: EXPECTED, pobreza, censo }))
console.log(`DONE: ${pobreza.length} manzanas, ${Object.keys(censo).length} census rows -> ${out}`)
