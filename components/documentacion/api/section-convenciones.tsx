import { CodeBlock } from "@/components/documentacion/api/code-block"
import { InlineCode } from "@/components/documentacion/api/inline-code"

const STATUSES = [
  { status: "200", code: "", meaning: "Respuesta correcta." },
  { status: "400", code: "invalid_parameter", meaning: "Un parámetro tiene un valor que no se acepta." },
  { status: "404", code: "not_found", meaning: "El recurso pedido no existe, por ejemplo un código de vereda desconocido." },
  { status: "502", code: "upstream_error", meaning: "Falló una de las fuentes de datos. Reintente más tarde." },
]

const FRESHNESS = [
  { resource: "Veredas", time: "24 horas" },
  { resource: "Riesgo (una vereda o todas)", time: "10 minutos" },
  { resource: "Alertas", time: "1 minuto" },
  { resource: "Sismos", time: "2 minutos" },
]

const ERROR_EXAMPLE = `{
  "error": {
    "code": "invalid_parameter",
    "message": "El parámetro accion debe ser informar, prepararse o actuar."
  }
}`

export function SectionApiConvenciones() {
  return (
    <section id="convenciones" className="flex scroll-mt-24 flex-col gap-5">
      <h2 className="text-2xl font-semibold tracking-tight">Convenciones</h2>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Sobre de respuesta</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Toda respuesta correcta tiene la forma <InlineCode>{"{ data, meta }"}</InlineCode>. El
          contenido está en <InlineCode>data</InlineCode>. En <InlineCode>meta</InlineCode> viaja{" "}
          <InlineCode>generadoEn</InlineCode> (fecha ISO 8601 en UTC), la{" "}
          <InlineCode>atribucion</InlineCode> que debe citar y, en los listados,{" "}
          <InlineCode>total</InlineCode>. Los ejemplos de esta página abrevian la atribución con
          puntos suspensivos.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Formato de los datos</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li className="text-pretty">Los nombres de los campos van en español y en camelCase.</li>
          <li className="text-pretty">Las coordenadas son latitud y longitud en grados (WGS84). Una caja envolvente se expresa como <InlineCode>sur, oeste, norte, este</InlineCode>.</li>
          <li className="text-pretty">Un valor <InlineCode>null</InlineCode> significa que el dato no está disponible, no que sea cero.</li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Errores</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Los errores devuelven el código HTTP correspondiente y un cuerpo con esta forma:
        </p>
        <CodeBlock label="Respuesta 400" code={ERROR_EXAMPLE} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <caption className="sr-only">Códigos de estado de la API</caption>
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">HTTP</th>
                <th scope="col" className="px-3 py-2 font-medium">error.code</th>
                <th scope="col" className="px-3 py-2 font-medium">Significado</th>
              </tr>
            </thead>
            <tbody>
              {STATUSES.map((row) => (
                <tr key={row.status} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.status}</td>
                  <td className="px-3 py-2">{row.code ? <InlineCode>{row.code}</InlineCode> : <span className="text-muted-foreground">-</span>}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Caché y frescura</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Las respuestas se guardan en caché en el borde de la red, así que un dato puede tener
          hasta este tiempo de antigüedad. Revise <InlineCode>meta.generadoEn</InlineCode> si
          necesita saber cuándo se calculó.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <caption className="sr-only">Frescura máxima por recurso</caption>
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Recurso</th>
                <th scope="col" className="px-3 py-2 font-medium">Antigüedad máxima</th>
              </tr>
            </thead>
            <tbody>
              {FRESHNESS.map((row) => (
                <tr key={row.resource} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">{row.resource}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
