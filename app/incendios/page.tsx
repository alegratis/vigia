import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FireOverview } from "@/components/fires/fire-overview"
import { IncendiosMapSection } from "@/components/maps/incendios-map-section"
import { DEPARTMENT } from "@/lib/firms/area"

export const metadata = {
  title: "Incendios — Vigía",
  description:
    "Monitoreo de focos de calor y fuegos activos para el Valle del Cauca, con datos satelitales de NASA FIRMS.",
}

export default function FirePage() {
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
              Amenaza · Incendios y focos de calor · {DEPARTMENT}
            </span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Monitoreo de incendios
            </h1>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Zonificación de la amenaza por incendios forestales en las veredas de
              Sevilla y Caicedonia, con el pronóstico del Índice Meteorológico de
              Incendio (FWI) de GWIS/Copernicus EFFIS superpuesto. Debajo, los focos de
              calor activos detectados por los sensores VIIRS de 375 m a bordo de los
              satélites Suomi NPP y NOAA-20/21, servidos por NASA FIRMS en tiempo casi
              real.
            </p>
          </div>

          <IncendiosMapSection />

          <div aria-live="polite">
            <FireOverview />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
