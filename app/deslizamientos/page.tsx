import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { DeslizamientosMapSection } from "@/components/maps/deslizamientos-map-section"
import { DEPARTMENT } from "@/lib/geoglows/stations"

export const metadata = {
  title: "Deslizamientos — Vigía",
  description:
    "Mapa y exposición demográfica ante deslizamientos para el Valle del Cauca.",
}

export default function LandslidesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus-visible:outline-none sm:px-6 sm:py-12"
      >
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a los modelos
        </Link>

        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Amenaza · Deslizamientos · {DEPARTMENT}
            </span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Deslizamientos
            </h1>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Zonificación de la susceptibilidad a deslizamiento en el corredor de
              Sevilla y Caicedonia (Zarzal, sobre el piso plano del valle, no
              presenta zonas en la capa fuente), a partir del índice de
              susceptibilidad de RED LabOT (11.721 puntos de evaluación). Los
              cinco niveles de amenaza (de muy bajo a muy alto) ya incorporan
              población, escuelas, hospitales, farmacias y otra infraestructura
              crítica expuesta en cada punto. El mapa se puede combinar con la
              humedad del suelo (NASA SMAP), la señal de disparo antecedente del
              deslizamiento.
            </p>
          </div>

          <DeslizamientosMapSection />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
