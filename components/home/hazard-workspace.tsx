"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Droplets, Flame, Mountain, type LucideIcon } from "lucide-react"
import { CategoryPanel } from "@/components/home/category-panel"
import { DeslizamientosPanelContent } from "@/components/home/deslizamientos-panel-content"
import { InundacionesPanelContent } from "@/components/home/inundaciones-panel-content"
import { IncendiosPanelContent } from "@/components/home/incendios-panel-content"
import { LiveAreaPopulation } from "@/components/maps/live-area-population"
import { mapModels, type MapModel } from "@/lib/maps"
import type { MapBounds } from "@/lib/map-bounds"

const hazardIcons: Record<string, LucideIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
}

/** Which DANE population category the shared sidebar card preselects for each hazard. */
const CATEGORY_BASIS: Record<string, { basis: "urbano" | "rural"; basisLabel: string }> = {
  deslizamientos: { basis: "rural", basisLabel: "Población rural" },
  inundaciones: { basis: "urbano", basisLabel: "Población urbana" },
  incendios: { basis: "rural", basisLabel: "Población rural" },
}

/**
 * Single-viewport homepage workspace: a static sidebar (mission statement +
 * one shared, viewport-based demographics card) next to an accordion of the
 * three hazard categories. Only the active category mounts its map and OSM
 * panels; the other two collapse into clickable photo strips. Whichever
 * category is active drives the sidebar's demographics card via
 * onBoundsChange/onZoneSelect.
 */
export function HazardWorkspace({ initialCategory }: { initialCategory: string }) {
  const [activeSlug, setActiveSlug] = useState(initialCategory)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [selectedMunicipio, setSelectedMunicipio] = useState<string | null>(null)

  const activeConfig = CATEGORY_BASIS[activeSlug] ?? CATEGORY_BASIS[mapModels[0].slug]

  function activate(slug: string) {
    if (slug === activeSlug) return
    setActiveSlug(slug)
    setBounds(null)
    setSelectedMunicipio(null)
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col focus-visible:outline-none lg:min-h-0 lg:flex-row"
    >
      <div className="flex flex-col items-center gap-6 border-b border-border bg-card p-6 text-center sm:p-8 lg:w-80 lg:shrink-0 lg:justify-between lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-96">
        <div className="flex w-full flex-col items-center gap-6">
          <span className="relative flex size-16 items-center justify-center">
            <Image
              src="/images/vigia-mark-light.png"
              alt=""
              width={84}
              height={65}
              className="block dark:hidden"
              priority
            />
            <Image
              src="/images/vigia-mark-dark.png"
              alt=""
              width={84}
              height={65}
              className="hidden dark:block"
              priority
            />
          </span>
          <div className="flex flex-col items-center gap-3">
            <h1 className="sr-only">Vigía</h1>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Observación satelital e inteligencia geoespacial para anticipar
              amenazas y fortalecer la respuesta ante emergencias en Sevilla,
              Caicedonia y Zarzal.
            </p>
          </div>
          <div className="w-full" aria-live="polite">
            <LiveAreaPopulation
              bounds={bounds}
              basis={activeConfig.basis}
              basisLabel={activeConfig.basisLabel}
              selectedMunicipio={selectedMunicipio}
              onClearSelection={() => setSelectedMunicipio(null)}
            />
          </div>
        </div>

        <Link
          href="/demografia"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Conoce tu nivel de exposición
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {mapModels.map((model: MapModel) => {
          const isActive = model.slug === activeSlug
          return (
            <CategoryPanel
              key={model.slug}
              model={model}
              icon={hazardIcons[model.slug] ?? Mountain}
              isActive={isActive}
              onActivate={() => activate(model.slug)}
            >
              {model.slug === "deslizamientos" && (
                <DeslizamientosPanelContent onBoundsChange={setBounds} />
              )}
              {model.slug === "inundaciones" && (
                <InundacionesPanelContent onBoundsChange={setBounds} onZoneSelect={setSelectedMunicipio} />
              )}
              {model.slug === "incendios" && (
                <IncendiosPanelContent onBoundsChange={setBounds} onZoneSelect={setSelectedMunicipio} />
              )}
            </CategoryPanel>
          )
        })}
      </div>
    </main>
  )
}
