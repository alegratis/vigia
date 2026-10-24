import { CodeBlock } from "@/components/documentacion/api/code-block"
import { InlineCode } from "@/components/documentacion/api/inline-code"
import { API_BASE_URL } from "@/components/documentacion/api/endpoints-data"

const JS_EXAMPLE = `const BASE = "${API_BASE_URL}/api/v1"

async function veredasEnActuar(municipio) {
  const url = BASE + "/riesgo?accion=actuar&municipio=" + encodeURIComponent(municipio)
  const res = await fetch(url)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error.code + ": " + body.error.message)
  return body.data
}

const veredas = await veredasEnActuar("Zarzal")
console.log(veredas.map((v) => v.nombre + ": " + v.nivel))`

const PYTHON_EXAMPLE = `import requests

BASE = "${API_BASE_URL}/api/v1"

r = requests.get(BASE + "/sismos", params={"minMagnitud": 3, "dias": 14}, timeout=30)
r.raise_for_status()

for sismo in r.json()["data"]:
    print(sismo["fecha"], sismo["magnitud"], sismo["lugar"])`

const MAP_EXAMPLE = `const res = await fetch("${API_BASE_URL}/api/v1/riesgo?formato=geojson")
const { data } = await res.json()

map.addSource("riesgo", { type: "geojson", data })
map.addLayer({
  id: "riesgo-relleno",
  type: "fill",
  source: "riesgo",
  paint: {
    "fill-opacity": 0.6,
    "fill-color": [
      "match", ["get", "accion"],
      "Actuar", "#d73027",
      "Prepararse", "#fdae61",
      "#91cf60"
    ]
  }
})`

const CLI_EXAMPLE = `curl -s "${API_BASE_URL}/api/v1/riesgo?formato=geojson" | jq .data > riesgo.geojson`

export function SectionApiEjemplos() {
  return (
    <section id="ejemplos" className="flex scroll-mt-24 flex-col gap-5">
      <h2 className="text-2xl font-semibold tracking-tight">Ejemplos de integración</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Ejemplos mínimos para empezar. Compruebe siempre <InlineCode>res.ok</InlineCode> antes de
        usar <InlineCode>data</InlineCode>, porque un error devuelve <InlineCode>error</InlineCode>{" "}
        en lugar de <InlineCode>data</InlineCode>.
      </p>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">JavaScript</h3>
        <CodeBlock label="Veredas que requieren actuar" code={JS_EXAMPLE} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Python</h3>
        <CodeBlock label="Sismos de las últimas dos semanas" code={PYTHON_EXAMPLE} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Mapa con MapLibre GL</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Con <InlineCode>formato=geojson</InlineCode>, <InlineCode>data</InlineCode> se pasa
          directamente como fuente GeoJSON. Leaflet funciona igual.
        </p>
        <CodeBlock label="Veredas coloreadas por acción" code={MAP_EXAMPLE} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Descarga para QGIS u otro SIG</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          El sobre <InlineCode>{"{ data, meta }"}</InlineCode> envuelve la colección, así que
          extraiga <InlineCode>data</InlineCode> antes de abrir el archivo en un SIG.
        </p>
        <CodeBlock label="Terminal" code={CLI_EXAMPLE} />
      </div>
    </section>
  )
}
