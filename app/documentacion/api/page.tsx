import { DocHeader } from "@/components/documentacion/doc-header"
import { DocToc } from "@/components/documentacion/doc-toc"
import { DocFooter } from "@/components/documentacion/doc-footer"
import { SectionApiIntro } from "@/components/documentacion/api/section-intro"
import { SectionApiConvenciones } from "@/components/documentacion/api/section-convenciones"
import { SectionApiEndpoints } from "@/components/documentacion/api/section-endpoints"
import { SectionApiInterpretacion } from "@/components/documentacion/api/section-interpretacion"
import { SectionApiEjemplos } from "@/components/documentacion/api/section-ejemplos"
import { SectionApiUsoResponsable } from "@/components/documentacion/api/section-uso-responsable"

export const metadata = {
  title: "API pública | Documentación | Vigía",
  description:
    "Referencia de la API pública de Vigía: veredas, riesgo compuesto, alertas y sismos en JSON y GeoJSON, sin clave, con especificación OpenAPI y ejemplos de integración.",
}

const API_SECTIONS = [
  { id: "introduccion", label: "Introducción" },
  { id: "convenciones", label: "Convenciones" },
  { id: "veredas", label: "Veredas" },
  { id: "riesgo", label: "Riesgo compuesto" },
  { id: "alertas", label: "Alertas" },
  { id: "sismos", label: "Sismos" },
  { id: "interpretacion", label: "Cómo interpretar el riesgo" },
  { id: "ejemplos", label: "Ejemplos de integración" },
  { id: "uso-responsable", label: "Uso responsable" },
]

export default function DocumentacionApiPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DocHeader subtitle="API pública" backHref="/documentacion" backLabel="Volver a la documentación" />
      <main id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-balance text-3xl font-semibold tracking-tight">API pública de Vigía</h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Referencia para integrar los datos de riesgo, alertas y sismos de Vigía en otras
            aplicaciones, sin reproducir la lógica de la plataforma.
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <DocToc sections={API_SECTIONS} />
          <div className="flex min-w-0 flex-col gap-14">
            <SectionApiIntro />
            <SectionApiConvenciones />
            <SectionApiEndpoints />
            <SectionApiInterpretacion />
            <SectionApiEjemplos />
            <SectionApiUsoResponsable />
          </div>
        </div>
      </main>
      <DocFooter />
    </div>
  )
}
