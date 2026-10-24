import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function SectionApi() {
  return (
    <section id="api" className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">API pública</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Los datos que produce Vigía también están disponibles para otras aplicaciones: veredas,
        riesgo compuesto en JSON o GeoJSON, alertas de las últimas 72 horas y sismos recientes. Es
        de solo lectura, no requiere clave y tiene especificación OpenAPI, de modo que se puede
        integrar sin reproducir la lógica de cálculo.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/documentacion/api"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Ver la documentación de la API
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <a
          href="/api/v1/openapi.json"
          className="rounded-md px-2 py-2 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Especificación OpenAPI
        </a>
      </div>
    </section>
  )
}
