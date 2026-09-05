import Link from "next/link"
import { ArrowLeft, Mountain } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Card, CardContent } from "@/components/ui/card"
import { HazardMapSection } from "@/components/maps/hazard-map-section"
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
              Amenaza · Deslizamientos · {DEPARTMENT}
            </span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Deslizamientos
            </h1>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Anticipamos dónde es más probable que ocurra un deslizamiento en el
              corredor de Sevilla, Caicedonia y Zarzal. El modelo de susceptibilidad
              que combinará pendiente, geología y precipitación en tiempo real está
              en definición; mientras tanto, esta sección muestra el mapa del
              territorio y la población expuesta en el área visible.
            </p>
          </div>

          <HazardMapSection
            slug="deslizamientos"
            title="Mapa de deslizamientos"
            basis="rural"
            basisLabel="Población rural"
          />

          <Card className="border-[var(--chart-3)]/50">
            <CardContent className="flex flex-col items-start gap-3 py-6">
              <div className="flex items-center gap-2 text-foreground">
                <Mountain className="size-5 text-[var(--chart-3)]" aria-hidden="true" />
                <p className="font-medium">Modelo de susceptibilidad próximamente</p>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Aún no hay una fuente satelital o hidrológica en vivo para clasificar
                el riesgo de deslizamiento como sí ocurre con las inundaciones
                (GEOGLOWS) y los incendios (NASA FIRMS). Cuando esté disponible,
                aparecerá aquí con la misma estructura de monitoreo en vivo.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
