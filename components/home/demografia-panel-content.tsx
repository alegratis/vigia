"use client"

import dynamic from "next/dynamic"
import { useMemo, useRef } from "react"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import { VulnerabilityBreakdownChart } from "@/components/charts/vulnerability-breakdown-chart"
import { VULNERABILITY_LEVEL_STYLES } from "@/lib/vulnerabilidad/levels"
import { useVulnerabilidad } from "@/lib/vulnerabilidad/use-vulnerabilidad"
import { resolveCssColor } from "@/lib/resolve-css-color"
import type { MapBounds } from "@/lib/map-bounds"

const DemografiaLiveMap = dynamic(
  () => import("@/components/maps/demografia-live-map").then((m) => m.DemografiaLiveMap),
  { ssr: false },
)

/** Same quintile cutoffs as `vulnerabilityLevelFromScore` (lib/vulnerabilidad/combined-score.ts), applied to a raw 0–1 HVI value so this panel's manzana bars use the same 5-tier color scale as the map. */
function levelColorForHvi(hvi: number): string {
  const level = hvi < 0.2 ? "Muy bajo" : hvi < 0.4 ? "Bajo" : hvi < 0.6 ? "Moderado" : hvi < 0.8 ? "Alto" : "Muy alto"
  return resolveCssColor(VULNERABILITY_LEVEL_STYLES[level].colorToken)
}

/**
 * Full explanation of the vulnerability index plus its manzana-level
 * breakdown — the below-map counterpart to the map's compact click popup.
 * Fetches its own copy of /api/vulnerabilidad (SWR dedupes against the map's
 * request) so the chart renders regardless of which map layer is active.
 */
function VulnerabilityExplainerSection() {
  const { data } = useVulnerabilidad(true)

  const topManzanas = useMemo(() => {
    if (!data) return []
    return data.hviUrbanoPorMunicipio
      .flatMap((m) => m.manzanas.map((manzana) => ({ ...manzana, municipio: m.municipio })))
      .sort((a, b) => b.hvi - a.hvi)
      .slice(0, 12)
      .map((m) => ({
        label: `${m.codigoManzana} (${m.municipio})`,
        value: m.hvi * 100,
        color: levelColorForHvi(m.hvi),
      }))
  }, [data])

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Índice de vulnerabilidad compuesto — qué es y cómo leerlo</p>
        <div className="mt-1.5 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Qué mide:</span> el Índice de Vulnerabilidad de Vivienda
            (HVI) evalúa qué tan frágil es una vivienda a partir de 8 componentes del Censo 2018 — material de
            paredes y pisos, hacinamiento mitigable y no mitigable, y acceso a acueducto, alcantarillado, energía y
            recolección de basuras. Va de 0 (vivienda menos frágil) a 1 (más frágil).
          </p>
          <p>
            <span className="font-medium text-foreground">Resolución:</span> en los cascos urbanos se calcula
            manzana por manzana a partir del IPM del DANE — la escala más fina disponible. En veredas rurales, donde
            el censo no publica manzanas, se usa el promedio municipal de déficit habitacional.
          </p>
          <p>
            <span className="font-medium text-foreground">Cómo se combina:</span> HVI × amenaza física (el nivel de{" "}
            <a href="/?categoria=riesgo-compuesto" className="underline underline-offset-2 hover:text-foreground">
              riesgo compuesto
            </a>{" "}
            de ese lugar, reescalado de 1 a 4) da la vulnerabilidad combinada, en un rango de 0 a 4.
          </p>
          <p>
            <span className="font-medium text-foreground">Para qué sirve:</span> identifica dónde la población vive
            en peores condiciones de vivienda Y está más expuesta al peligro físico — la combinación que debería
            priorizarse al asignar recursos de mitigación, reasentamiento o mejoramiento de vivienda.
          </p>
        </div>
      </div>
      {topManzanas.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-foreground">
            Las 12 manzanas censales más vulnerables (de los 4 municipios)
          </p>
          <VulnerabilityBreakdownChart rows={topManzanas} valueSuffix="% HVI" height={320} />
        </div>
      )}
    </div>
  )
}

interface DemografiaPanelContentProps {
  /** Bubbles the map's viewport up to the workspace's shared sidebar card. */
  onBoundsChange?: (bounds: MapBounds) => void
}

/**
 * Expanded Demografía panel for the homepage workspace, mirroring
 * `SismologiaPanelContent`'s structure: the 3D indicator map fills the full
 * first fold; a short explainer and source caption scroll in below.
 */
export function DemografiaPanelContent({ onBoundsChange }: DemografiaPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa 3D de indicadores demográficos"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo en 3D con indicadores del geoportal de DANE: el índice de pobreza
          multidimensional por manzana censal en los cascos urbanos, las cifras de viviendas, hogares
          y personas por manzana censal, y el índice de vulnerabilidad compuesto por vereda, para
          Sevilla, Caicedonia, Zarzal y Roldanillo.
        </p>
        <DemografiaLiveMap className="relative isolate h-full w-full" onBoundsChange={onBoundsChange} />
        <ScrollHintButton targetRef={captionRef} label="Ver más sobre estos indicadores" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Las columnas 3D representan, según el indicador activo en el panel de la derecha, el
            índice de pobreza multidimensional (IPM) por manzana censal (donde el DANE lo publica) o
            el número de viviendas, hogares o personas por manzana censal — mientras más alta y más
            intensa la columna, mayor el valor del indicador en ese lugar.
          </p>
          <p>
            El índice de vulnerabilidad compuesto, que combina esta condición social con el riesgo
            físico ya calculado en{" "}
            <a href="/?categoria=riesgo-compuesto" className="underline underline-offset-2 hover:text-foreground">
              Riesgo compuesto
            </a>
            , se añade como una tercera capa en este mismo mapa.
          </p>
        </div>
        <VulnerabilityExplainerSection />
        <p className="text-xs text-muted-foreground">
          Fuente:{" "}
          <a
            href="https://geoportal.dane.gov.co/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Geoportal del DANE
          </a>{" "}
          — índice de pobreza multidimensional (
          <a
            href="https://geoportal.dane.gov.co/visipm"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            visipm
          </a>
          ) y estadísticas integradas del Censo Nacional de Población y Vivienda 2018 (
          <a
            href="https://geoportal.dane.gov.co/geovisores/sociedad/estadisticas-integradas/?cod_dimension=1"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            estadísticas integradas
          </a>
          ). Ambos son servicios públicos de ArcGIS del DANE, consultados por código de municipio.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
