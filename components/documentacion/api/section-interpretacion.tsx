import { InlineCode } from "@/components/documentacion/api/inline-code"

const ITEMS = [
  {
    title: "nivel y puntaje no son lo mismo",
    body: (
      <>
        <InlineCode>nivel</InlineCode> (Muy bajo, Bajo, Moderado, Alto, Muy alto) lo fija la
        amenaza más grave, siguiendo el criterio de la OMM y GDACS, no el promedio. Así una sola
        amenaza severa no se diluye entre las demás. <InlineCode>puntaje</InlineCode> es un
        promedio ponderado de 0 a 1 que sirve para ordenar veredas dentro de un mismo nivel, y no
        determina el nivel. Por eso una vereda en nivel Muy alto puede tener un puntaje bajo, como
        el 0.47 del ejemplo.
      </>
    ),
  },
  {
    title: "accion es lo que se recomienda hacer",
    body: (
      <>
        Es <InlineCode>Informar</InlineCode>, <InlineCode>Prepararse</InlineCode> o{" "}
        <InlineCode>Actuar</InlineCode>, de menor a mayor gravedad. El filtro{" "}
        <InlineCode>accion</InlineCode> de <InlineCode>/api/v1/riesgo</InlineCode> usa ese orden:
        pedir <InlineCode>prepararse</InlineCode> incluye también las veredas en Actuar.
      </>
    ),
  },
  {
    title: "Cada amenaza tiene su propia escala",
    body: (
      <>
        En <InlineCode>amenazas</InlineCode> viene una entrada por cada una: deslizamientos,
        inundaciones, incendios, precipitación y sismología. Sus etiquetas de nivel pueden variar
        entre amenazas (por ejemplo Baja o Bajo, Muy alta o Muy alto). Compare niveles solo dentro
        de la misma amenaza, o use el <InlineCode>nivel</InlineCode> global de la vereda.{" "}
        <InlineCode>amenazaDominante</InlineCode> indica cuál domina el resultado.
      </>
    ),
  },
  {
    title: "Cuándo aparece null",
    body: (
      <>
        <InlineCode>nivel</InlineCode>, <InlineCode>puntaje</InlineCode> y{" "}
        <InlineCode>accion</InlineCode> son <InlineCode>null</InlineCode> cuando no hay datos
        suficientes para calcularlos. <InlineCode>poblacion</InlineCode> e{" "}
        <InlineCode>infraestructura</InlineCode> pueden ser <InlineCode>null</InlineCode> en
        veredas sin cifras disponibles; <InlineCode>sitiosCriticos</InlineCode> siempre es un
        entero.
      </>
    ),
  },
  {
    title: "Alertas",
    body: (
      <>
        Solo hay dos niveles: <InlineCode>prepararse</InlineCode> y <InlineCode>actuar</InlineCode>.
        Se publican únicamente las alertas emitidas en vivo; los eventos que se registran en modo
        sombra, sin envío a suscriptores, no aparecen en la API.
      </>
    ),
  },
]

export function SectionApiInterpretacion() {
  return (
    <section id="interpretacion" className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Cómo interpretar el riesgo</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Estos puntos evitan los errores de lectura más comunes. La metodología completa está en la{" "}
        <a
          href="/documentacion#metodologia"
          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          documentación general
        </a>
        .
      </p>
      <div className="flex flex-col gap-4">
        {ITEMS.map((item) => (
          <div key={item.title} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
