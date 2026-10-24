import { InlineCode } from "@/components/documentacion/api/inline-code"
import { API_BASE_URL } from "@/components/documentacion/api/endpoints-data"

const RESOURCES = [
  { path: "/api/v1/veredas", description: "Listado de veredas con su caja envolvente y centro." },
  { path: "/api/v1/veredas/{codigoVereda}", description: "Riesgo compuesto de una vereda." },
  { path: "/api/v1/riesgo", description: "Riesgo compuesto de todas las veredas, en JSON o GeoJSON." },
  { path: "/api/v1/alertas", description: "Alertas emitidas en las últimas 72 horas." },
  { path: "/api/v1/sismos", description: "Sismos recientes de SGC y USGS, sin duplicados." },
]

export function SectionApiIntro() {
  return (
    <section id="introduccion" className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Introducción</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        La API de Vigía entrega en JSON los datos que produce la plataforma, para que otras
        aplicaciones los usen sin reproducir la lógica de cálculo. Es de solo lectura, no requiere
        clave ni registro y admite llamadas desde cualquier origen (CORS abierto).
      </p>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-foreground">URL base</dt>
          <dd>
            <InlineCode>{API_BASE_URL}/api/v1</InlineCode>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-medium text-foreground">Especificación OpenAPI 3</dt>
          <dd className="text-pretty leading-relaxed text-muted-foreground">
            <a
              href="/api/v1/openapi.json"
              className="font-mono text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              /api/v1/openapi.json
            </a>
            . Impórtela en Postman, Insomnia o Swagger UI, o genere un cliente tipado con las
            herramientas de OpenAPI.
          </dd>
        </div>
      </dl>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <caption className="sr-only">Recursos disponibles de la API v1</caption>
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Recurso</th>
              <th scope="col" className="px-3 py-2 font-medium">Qué devuelve</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((resource) => (
              <tr key={resource.path} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2">
                  <InlineCode>{resource.path}</InlineCode>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{resource.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-pretty rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">Vigía no es un sistema oficial de alerta.</strong>{" "}
        Los datos son una ayuda para la toma de decisiones. Ante una emergencia, llame al 123.
      </p>
    </section>
  )
}
