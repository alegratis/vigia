import Link from "next/link"
import { ArrowRight, Droplets, Flame, Mountain } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { MapTile } from "@/components/map-tile"
import { mapModels } from "@/lib/maps"

const pillars = [
  { icon: Mountain, label: "Deslizamientos" },
  { icon: Droplets, label: "Inundaciones" },
  { icon: Flame, label: "Incendios" },
]

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
            <div className="flex flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                Inteligencia geoespacial de código abierto
              </span>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                Anticipar impactos y fortalecer la respuesta ante emergencias
              </h1>
              <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Vigía combina observación satelital, inteligencia geoespacial y
                monitoreo continuo para identificar la exposición, estimar posibles
                impactos sobre comunidades e infraestructura, y generar alertas
                tempranas que facilitan una respuesta oportuna.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/demografia"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Conoce tu nivel de exposición
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/inundaciones"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Ver monitoreo en vivo
                </Link>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-4 rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                ¿Qué es Vigía?
              </h2>
              <p className="text-pretty leading-relaxed text-muted-foreground">
                Una plataforma de gestión del riesgo construida sobre datos y
                herramientas abiertas. Vigía prioriza el Valle del Cauca (Sevilla,
                Caicedonia y Zarzal) y monitorea tres amenazas principales.
              </p>
              <ul className="flex flex-col gap-3">
                {pillars.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="amenazas" className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="mb-8 flex flex-col gap-2">
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              Amenazas monitoreadas
            </h2>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Seleccione una amenaza para abrir su interfaz de monitoreo. Cada módulo
              se alimenta de fuentes de datos abiertas y expone sus propias
              herramientas de análisis y alerta temprana.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {mapModels.map((model) => (
              <MapTile key={model.slug} model={model} />
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
