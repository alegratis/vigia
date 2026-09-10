import Image from "next/image"

export function SectionResumen() {
  return (
    <section id="resumen" className="flex flex-col gap-4 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">Resumen</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Vigía es una plataforma de código abierto para la evaluación y gestión de riesgos en tres
        municipios del Valle del Cauca, Colombia: Sevilla, Caicedonia y Zarzal. Cruza amenazas
        naturales de deslizamiento, inundación e incendio forestal con la población y la
        infraestructura crítica expuestas, combinando índices de amenaza estáticos con pronósticos
        y monitoreo en vivo de fuentes abiertas.
      </p>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        La aplicación no mantiene una base de datos propia: cada vista es una capa de agregación
        en tiempo real sobre servicios geoespaciales públicos (ArcGIS, WMS, WMTS, APIs REST) —
        descrito en detalle en{" "}
        <a href="#arquitectura" className="text-primary hover:underline">
          Arquitectura
        </a>{" "}
        y{" "}
        <a href="#fuentes" className="text-primary hover:underline">
          Fuentes de datos
        </a>
        .
      </p>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1 sm:flex-1">
          <p className="text-sm font-medium text-foreground">Índices de amenaza y créditos</p>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            Los índices de susceptibilidad a deslizamientos e incendios forestales que sostienen
            esta plataforma fueron desarrollados por RED LabOT, la Red de Laboratorios de
            Observación de la Tierra de las Américas.
          </p>
        </div>
        <a
          href="https://redlabot.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center justify-center rounded-md sm:w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/images/redlabot-mark-light.png"
            alt="RED LabOT — Red de Laboratorios de Observación de la Tierra de las Américas"
            width={175}
            height={79}
            className="block h-16 w-auto dark:hidden"
          />
          <Image
            src="/images/redlabot-mark-dark.png"
            alt="RED LabOT — Red de Laboratorios de Observación de la Tierra de las Américas"
            width={175}
            height={79}
            className="hidden h-16 w-auto dark:block"
          />
        </a>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1 sm:flex-1">
          <p className="text-sm font-medium text-foreground">NASA Lifelines</p>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            Vigía forma parte de la comunidad de NASA Lifelines, una iniciativa de la División de
            Ciencias de la Tierra de la NASA y la firma DevGlobal que impulsa el uso de datos
            satelitales para fortalecer la acción humanitaria.
          </p>
        </div>
        <a
          href="https://nasalifelines.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center justify-center rounded-md bg-neutral-900 px-4 py-3 sm:w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/images/nasa-lifelines-wordmark-white.png"
            alt="NASA Lifelines"
            width={2084}
            height={263}
            className="h-6 w-auto"
          />
        </a>
      </div>
    </section>
  )
}
