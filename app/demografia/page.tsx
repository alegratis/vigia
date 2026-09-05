import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { DemografiaOverview } from "@/components/demografia/demografia-overview"

export const metadata = {
  title: "Demografía y exposición | Vigía",
  description:
    "Población de referencia por municipio en el Valle del Cauca, cruzada con las amenazas de inundación, incendio y deslizamiento monitoreadas por Vigía.",
}

export default function DemografiaPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-12">
            <h1 className="text-balance text-3xl font-semibold tracking-tight">
              Conoce tu nivel de exposición
            </h1>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Población de Sevilla, Caicedonia y Zarzal según el DANE,
              cruzada con la señal de monitoreo en vivo de cada amenaza para
              estimar quién está más expuesto y dónde.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-10">
          <DemografiaOverview />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
