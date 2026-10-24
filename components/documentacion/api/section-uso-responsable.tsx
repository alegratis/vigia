import { InlineCode } from "@/components/documentacion/api/inline-code"

export function SectionApiUsoResponsable() {
  return (
    <section id="uso-responsable" className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Uso responsable</h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li className="text-pretty">
          <strong className="font-medium text-foreground">Respete el caché.</strong> No hay clave ni
          cuota por usuario, pero consultar con más frecuencia que la frescura indicada no devuelve
          datos nuevos y solo consume recursos. Pedir riesgo cada pocos minutos es suficiente.
        </li>
        <li className="text-pretty">
          <strong className="font-medium text-foreground">Cite la fuente.</strong> Muestre la{" "}
          <InlineCode>meta.atribucion</InlineCode> de la respuesta, o al menos &quot;Vigía (RED
          LabOT)&quot;, junto a los datos que publique.
        </li>
        <li className="text-pretty">
          <strong className="font-medium text-foreground">No lo presente como alerta oficial.</strong>{" "}
          Vigía es una herramienta de apoyo. Las órdenes de evacuación y las alertas oficiales las
          emiten las autoridades.
        </li>
        <li className="text-pretty">
          <strong className="font-medium text-foreground">Tolere campos nuevos.</strong> Se pueden
          añadir campos a la versión v1 sin aviso, así que su cliente debe ignorar los que no
          conozca. Los cambios que rompan la compatibilidad saldrán bajo una versión nueva de la
          ruta.
        </li>
        <li className="text-pretty">
          <strong className="font-medium text-foreground">Cuéntenos qué construye.</strong> Si
          integra Vigía en una aplicación o necesita otro dato, escriba a{" "}
          <a
            href="mailto:apino@redlabot.org"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            apino@redlabot.org
          </a>
          .
        </li>
      </ul>
    </section>
  )
}
