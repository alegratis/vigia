/**
 * Convierte la salida de extract-infrastructure.py en puntos clasificados y los guarda en
 * dos sitios: el archivo estático de respaldo (lib/osm/data/infraestructura.json) y la copia
 * de Supabase que sirve la API (upstream_snapshots, clave osm:infraestructura).
 * Con el segundo argumento (vias.json del extractor) también guarda la red vial, clave osm:vias.
 *
 * Solo usa fetch para hablar con Supabase, así que corre en CI sin instalar el proyecto.
 *
 * Uso:
 *   npx tsx --env-file=<entorno> scripts/osm/seed-infrastructure.mts <infraestructura.json> [vias.json]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { elementsToPoints, type OverpassElement } from "../../lib/osm/points"

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")

const SOURCE_NOTE = "Copia cargada desde el extracto de Geofabrik; Overpass no es alcanzable"

async function saveSnapshot(key: string, payload: unknown): Promise<void> {
  const now = new Date().toISOString()
  const response = await fetch(`${url}/rest/v1/upstream_snapshots?on_conflict=key`, {
    method: "POST",
    headers: {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      key,
      payload,
      fetched_at: now,
      size_bytes: Buffer.byteLength(JSON.stringify(payload)),
      last_status: "stale",
      last_error: SOURCE_NOTE,
      last_checked_at: now,
    }),
  })
  if (!response.ok) throw new Error(`No se pudo guardar ${key}: HTTP ${response.status} ${await response.text()}`)
}

const infraInput = process.argv[2]
if (!infraInput) throw new Error("Falta la ruta del JSON de infraestructura del extractor")

const raw = JSON.parse(readFileSync(infraInput, "utf8")) as { elements: OverpassElement[] }
const points = elementsToPoints(raw.elements)
const byCategory = points.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.category]: (acc[p.category] ?? 0) + 1 }), {})
console.log(`elementos: ${raw.elements.length} -> puntos clasificados: ${points.length}`, byCategory)

if (points.length === 0) throw new Error("El extracto no produjo ningún punto: no se sobrescribe la copia existente")

writeFileSync(new URL("../../lib/osm/data/infraestructura.json", import.meta.url), JSON.stringify(points))
await saveSnapshot("osm:infraestructura", points)
console.log("copia guardada en Supabase: osm:infraestructura")

const roadsInput = process.argv[3]
if (roadsInput) {
  const { vertices } = JSON.parse(readFileSync(roadsInput, "utf8")) as { vertices: Array<[number, number]> }
  if (vertices.length === 0) throw new Error("El extracto no produjo ninguna vía: no se sobrescribe la copia existente")
  await saveSnapshot("osm:vias", vertices)
  console.log(`red vial guardada en Supabase: osm:vias (${vertices.length} vértices)`)
}
