"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { ArrowRight, Activity, CloudRain, Droplets, Flame, Mountain, ShieldAlert, type LucideIcon } from "lucide-react"
import { CategoryPanel } from "@/components/home/category-panel"
import { DeslizamientosPanelContent } from "@/components/home/deslizamientos-panel-content"
import { InundacionesPanelContent } from "@/components/home/inundaciones-panel-content"
import { IncendiosPanelContent } from "@/components/home/incendios-panel-content"
import { PrecipitacionPanelContent } from "@/components/home/precipitacion-panel-content"
import { SismologiaPanelContent } from "@/components/home/sismologia-panel-content"
import { RiesgoCompuestoPanelContent } from "@/components/home/riesgo-compuesto-panel-content"
import { LiveAreaPopulation } from "@/components/maps/live-area-population"
import { LiveInfrastructureCategories } from "@/components/maps/live-infrastructure-categories"
import { LiveInfrastructureBuildings } from "@/components/maps/live-infrastructure-buildings"
import { useOsmInfrastructure } from "@/lib/osm/use-infrastructure"
import type { OsmCategoryKey } from "@/lib/osm/categories"
import { mapModels, type MapModel } from "@/lib/maps"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"
import { openInfoPopup } from "@/lib/open-info-popup"

const hazardIcons: Record<string, LucideIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
  precipitacion: CloudRain,
  sismologia: Activity,
  "riesgo-compuesto": ShieldAlert,
}

/** Which DANE population category the shared sidebar card preselects for each hazard. */
const CATEGORY_BASIS: Record<string, { basis: "urbano" | "rural"; basisLabel: string }> = {
  deslizamientos: { basis: "rural", basisLabel: "Población rural" },
  inundaciones: { basis: "urbano", basisLabel: "Población urbana" },
  incendios: { basis: "rural", basisLabel: "Población rural" },
  precipitacion: { basis: "rural", basisLabel: "Población rural" },
  sismologia: { basis: "rural", basisLabel: "Población rural" },
  "riesgo-compuesto": { basis: "rural", basisLabel: "Población rural" },
}

/**
 * Single-viewport homepage workspace: a static sidebar (mission statement +
 * one shared, viewport-based demographics card + OSM infrastructure
 * toggles) next to an accordion of the three hazard categories. Only the
 * active category mounts its map; the other two collapse into clickable
 * photo strips. The sidebar's infrastructure toggles drive every map's
 * markers directly, so switching hazards keeps whatever categories were
 * already turned on. Whichever category is active also drives the
 * sidebar's demographics card via onBoundsChange/onZoneSelect.
 */
export function HazardWorkspace({ initialCategory }: { initialCategory: string }) {
  const [activeSlug, setActiveSlug] = useState(initialCategory)
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const [selectedMunicipio, setSelectedMunicipio] = useState<string | null>(null)
  // Owned here (rather than inside DeslizamientosPanelContent) so the shared sidebar demographics
  // card can narrow its population figures down to whatever vereda is clicked on that map.
  const [selectedVereda, setSelectedVereda] = useState<VeredaFeature | null>(null)
  const { points: osmPoints, isLoading: osmLoading, error: osmError } = useOsmInfrastructure()
  const [activeOsmCategories, setActiveOsmCategories] = useState<Set<OsmCategoryKey>>(new Set())

  const activeConfig = CATEGORY_BASIS[activeSlug] ?? CATEGORY_BASIS[mapModels[0].slug]

  const handleVeredaSelect = useCallback((feature: VeredaFeature | null) => {
    setSelectedVereda(feature)
    setSelectedMunicipio(feature ? feature.properties.municipio : null)
  }, [])

  const clearSidebarSelection = useCallback(() => {
    setSelectedMunicipio(null)
    setSelectedVereda(null)
  }, [])

  const toggleOsmCategory = useCallback((key: OsmCategoryKey) => {
    setActiveOsmCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const activeOsmPoints = useMemo(
    () => osmPoints?.filter((p) => activeOsmCategories.has(p.category)) ?? [],
    [osmPoints, activeOsmCategories],
  )

  function activate(slug: string) {
    if (slug === activeSlug) return
    setActiveSlug(slug)
    setBounds(null)
    setSelectedMunicipio(null)
    setSelectedVereda(null)
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 flex-col focus-visible:outline-none lg:min-h-0 lg:flex-row"
    >
      <div className="flex flex-col gap-6 border-b border-border bg-card p-6 sm:p-8 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-96">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-4">
            <span className="relative flex h-12 items-center justify-center">
              <Image
                src="/images/redlabot-mark-light.png"
                alt="RED LabOT"
                width={100}
                height={45}
                className="block h-9 w-auto dark:hidden"
                priority
              />
              <Image
                src="/images/redlabot-mark-dark.png"
                alt="RED LabOT"
                width={100}
                height={45}
                className="hidden h-9 w-auto dark:block"
                priority
              />
            </span>
            <span aria-hidden="true" className="h-10 w-px bg-border" />
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
          </div>
          <div className="flex flex-col items-center gap-3">
            <h1 className="sr-only">Vigía</h1>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Observación satelital e inteligencia geoespacial para anticipar
              amenazas y fortalecer la respuesta ante emergencias en Sevilla,
              Caicedonia y Zarzal.
            </p>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">En colaboración con</span>
            <a
              href="https://nasalifelines.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Image
                src="/images/nasa-lifelines-wordmark-darkblue.png"
                alt="NASA Lifelines"
                width={5112}
                height={643}
                className="block h-5 w-auto dark:hidden"
              />
              <Image
                src="/images/nasa-lifelines-wordmark-white.png"
                alt="NASA Lifelines"
                width={5112}
                height={643}
                className="hidden h-5 w-auto dark:block"
              />
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openInfoPopup("/exposicion/popup", "vigia-exposicion", { width: 1180, height: 980 })}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Conoce tu nivel de exposición
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>

        <div aria-live="polite" className="shrink-0">
          <LiveAreaPopulation
            bounds={bounds}
            basis={activeConfig.basis}
            basisLabel={activeConfig.basisLabel}
            selectedMunicipio={selectedMunicipio}
            selectedVereda={selectedVereda}
            onClearSelection={clearSidebarSelection}
          />
        </div>

        <LiveInfrastructureCategories
          className="shrink-0"
          bounds={bounds}
          points={osmPoints}
          isLoading={osmLoading}
          error={osmError}
          activeCategories={activeOsmCategories}
          onToggleCategory={toggleOsmCategory}
        />

        <LiveInfrastructureBuildings
          className="shrink-0"
          bounds={bounds}
          points={osmPoints}
          activeCategories={activeOsmCategories}
        />
      </div>

      {/*
        min-h-0/flex-1 are lg-only: on desktop this row must fill whatever height <main> has left after
        the fixed viewport clamp in page.tsx, which needs the min-h-0 override so it can shrink below its
        children's natural size. On mobile there's no such clamp — the page just scrolls — so this row
        should size itself off its children's own explicit heights (the active category's h-[70vh] map,
        the collapsed strips' basis-20) instead of being forced into a min-height:0 flex item that has no
        ambient space to grow into, which is what was collapsing the active map to a sliver.
      */}
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
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
                <DeslizamientosPanelContent
                  onBoundsChange={setBounds}
                  activeOsmPoints={activeOsmPoints}
                  selectedVereda={selectedVereda}
                  onVeredaSelect={handleVeredaSelect}
                />
              )}
              {model.slug === "inundaciones" && (
                <InundacionesPanelContent
                  onBoundsChange={setBounds}
                  onZoneSelect={setSelectedMunicipio}
                  onVeredaSelect={handleVeredaSelect}
                  activeOsmPoints={activeOsmPoints}
                  selectedVereda={selectedVereda}
                />
              )}
              {model.slug === "incendios" && (
                <IncendiosPanelContent
                  onBoundsChange={setBounds}
                  onZoneSelect={setSelectedMunicipio}
                  onVeredaSelect={handleVeredaSelect}
                  activeOsmPoints={activeOsmPoints}
                />
              )}
              {model.slug === "precipitacion" && (
                <PrecipitacionPanelContent
                  onBoundsChange={setBounds}
                  onZoneSelect={setSelectedMunicipio}
                  onVeredaFeatureSelect={handleVeredaSelect}
                  activeOsmPoints={activeOsmPoints}
                />
              )}
              {model.slug === "sismologia" && (
                <SismologiaPanelContent
                  onBoundsChange={setBounds}
                  onVeredaSelect={handleVeredaSelect}
                  activeOsmPoints={activeOsmPoints}
                />
              )}
              {model.slug === "riesgo-compuesto" && (
                <RiesgoCompuestoPanelContent onBoundsChange={setBounds} activeOsmPoints={activeOsmPoints} />
              )}
            </CategoryPanel>
          )
        })}
      </div>
    </main>
  )
}
