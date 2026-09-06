import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Droplets, Flame, Mountain, type LucideIcon } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { HazardColumn } from "@/components/hazard-column"
import { mapModels } from "@/lib/maps"

const hazardIcons: Record<string, LucideIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
}

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col focus-visible:outline-none lg:min-h-[calc(100vh-4rem)] lg:flex-row"
      >
        <div className="flex flex-col items-center gap-8 border-b border-border bg-card p-6 text-center sm:p-10 lg:w-80 lg:shrink-0 lg:justify-between lg:border-b-0 lg:border-r xl:w-96">
          <div className="flex flex-col items-center gap-6">
            <span className="relative flex size-20 items-center justify-center">
              <Image
                src="/images/vigia-mark-light.png"
                alt=""
                width={104}
                height={80}
                className="block dark:hidden"
                priority
              />
              <Image
                src="/images/vigia-mark-dark.png"
                alt=""
                width={104}
                height={80}
                className="hidden dark:block"
                priority
              />
            </span>
            <div className="flex flex-col items-center gap-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight">Vigía</h1>
              <p className="text-pretty leading-relaxed text-muted-foreground">
                Observación satelital e inteligencia geoespacial para anticipar
                amenazas y fortalecer la respuesta ante emergencias en Sevilla,
                Caicedonia y Zarzal.
              </p>
            </div>
          </div>

          <Link
            href="/demografia"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Conoce tu nivel de exposición
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          {mapModels.map((model) => (
            <HazardColumn key={model.slug} model={model} icon={hazardIcons[model.slug] ?? Mountain} />
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
