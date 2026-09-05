import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FloodOverview } from "@/components/flood/flood-overview"
import { HazardMapSection } from "@/components/maps/hazard-map-section"
import { DEPARTMENT } from "@/lib/geoglows/stations"

export const metadata = {
  title: "Inundaciones — Vigía",
  description:
    "Pronóstico y medición de inundaciones fluviales para el Valle del Cauca, con datos de GEOGLOWS.",
}

export default function FloodPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
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
              Amenaza · Inundación fluvial · {DEPARTMENT}
            </span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Pronóstico de inundaciones
            </h1>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Monitoreo de caudales para los tramos prioritarios alrededor de Sevilla,
              Caicedonia y Zarzal. Los pronósticos provienen del modelo hidrológico
              GEOGLOWS y se clasifican con umbrales de periodo de retorno calculados
              sobre el registro histórico.
            </p>
          </div>

          <HazardMapSection
            slug="inundaciones"
            title="Mapa de inundaciones"
            basis="urbano"
            basisLabel="Población urbana"
          />

          <FloodOverview />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
