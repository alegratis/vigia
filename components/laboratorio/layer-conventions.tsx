"use client"

import type { ReactNode } from "react"
import { resolveSubLayerOn, type LayerKey } from "@/lib/laboratorio/layers"
import { OSM_CATEGORIES } from "@/lib/osm/categories"
import { useOsmCategoryColors } from "@/lib/osm/use-osm-colors"
import { GWIS_LEGEND_URL } from "@/lib/incendios/gwis"
import { GWIS_LANDCOVER_LEGEND_URL } from "@/lib/land-cover/gwis-landcover"
import { GWIS_PROTECTED_AREAS_LEGEND_URL, GWIS_SETTLEMENT_LEGEND_URL } from "@/lib/demografia/gwis-context-layers"
import { COVERAGE_RADIUS_DEFAULT_M, COVERAGE_RADIUS_TIGHT_M } from "@/lib/laboratorio/use-hidrantes-experience"
import { WmsLegendChip } from "@/components/maps/wms-legend-chip"
import { cn } from "@/lib/utils"

/**
 * Unit/range hint shown next to each level in a fill layer's legend, so the
 * colors read as quantities and not just labels. Layers whose levels come
 * from a published model (susceptibilidad, amenaza) carry no numeric range
 * of their own, so they are described in `LAYER_SUMMARY` instead.
 */
export const LEVEL_HINTS: Partial<Record<LayerKey, Record<string, string>>> = {
  precipitacion: {
    Bajo: "< 35 mm",
    Moderado: "35 – 75 mm",
    Alto: "75 – 150 mm",
    "Muy alto": "> 150 mm",
  },
  clima: {
    Frío: "< 14 °C",
    Fresco: "14 – 18 °C",
    Templado: "18 – 22 °C",
    Cálido: "22 – 26 °C",
    Caluroso: "≥ 26 °C",
  },
}

/** One-line statement of what the fill colors encode — the "how to read this map" sentence. */
const LAYER_SUMMARY: Record<LayerKey, string> = {
  deslizamientos: "Color = nivel de susceptibilidad a movimientos en masa dominante en cada vereda.",
  inundaciones: "Color = nivel de susceptibilidad a inundación dominante en cada vereda.",
  incendios: "Color = nivel de amenaza por incendio forestal en cada vereda.",
  precipitacion: "Color = lluvia acumulada pronosticada a 7 días por vereda (mm). POP% = probabilidad de lluvia.",
  clima: "Color = temperatura actual en el centro de cada vereda. Entre paréntesis, la sensación térmica.",
  "riesgo-compuesto": "Color = la amenaza más severa entre deslizamientos, inundaciones e incendios.",
  demografia: "Color = nivel del indicador elegido (vulnerabilidad, pobreza o manzanas).",
  sismologia: "Círculo = evento sísmico; su tamaño crece con la magnitud.",
  hidrantes: "Cada punto es un hidrante. El color indica su relación con tu ubicación.",
}

export function LegendSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-border/70 px-4 py-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  )
}

export function LegendRow({
  color,
  label,
  hint,
  round,
}: {
  color: string
  label: string
  hint?: string
  round?: boolean
}) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={cn("size-2.5 shrink-0", round ? "rounded-full" : "rounded-sm")}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="flex-1 truncate text-foreground">{label}</span>
      {hint && <span className="text-muted-foreground">{hint}</span>}
    </li>
  )
}

function LegendLine({ color, label, dashed, thick }: { color: string; label: string; dashed?: boolean; thick?: boolean }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className="w-5 shrink-0 border-t-0"
        style={{
          borderTopStyle: dashed ? "dashed" : "solid",
          borderTopWidth: thick ? 3 : 2,
          borderTopColor: color,
        }}
        aria-hidden="true"
      />
      <span className="text-foreground">{label}</span>
    </li>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <li className="text-xs leading-snug text-muted-foreground">{children}</li>
}

/** Sentence under the layer title explaining how to read its colors. */
export function LayerSummary({ layer }: { layer: LayerKey }) {
  return <p className="text-xs leading-snug text-muted-foreground">{LAYER_SUMMARY[layer]}</p>
}

function OsmInfraLegend() {
  const colors = useOsmCategoryColors()
  return (
    <LegendSection title="Infraestructura (OpenStreetMap)">
      {OSM_CATEGORIES.map((category) => (
        <LegendRow key={category.key} round color={colors?.[category.key] ?? "transparent"} label={category.label} />
      ))}
    </LegendSection>
  )
}

function Chip({ title, src, alt }: { title: string; src: string; alt: string }) {
  return (
    <div className="border-t border-border/70 px-4 py-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</p>
      <WmsLegendChip src={src} alt={alt} className="block max-w-full" />
    </div>
  )
}

/** Legends for whichever context overlays ("Capas" checklist) of the focused layer are currently on. */
function SubLayerConventions({ layer, subLayerToggles }: { layer: LayerKey; subLayerToggles: Record<string, boolean> }) {
  const on = (id: string) => resolveSubLayerOn(layer, id, subLayerToggles)
  return (
    <>
      {on("imerg") && (
        <LegendSection title="Precipitación IMERG (NASA, tasa cada 30 min)">
          <li>
            <div
              className="h-2 w-full rounded-full"
              style={{ background: "linear-gradient(90deg, #a5f3fc, #38bdf8, #2563eb, #7c3aed, #db2777)" }}
              aria-hidden="true"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Llovizna</span>
              <span>Intensa</span>
            </div>
          </li>
        </LegendSection>
      )}
      {on("quebradas") && (
        <LegendSection title="Hidrografía">
          <LegendLine color="#0ea5e9" label="Quebrada o río (clic para nombre)" />
        </LegendSection>
      )}
      {on("fires-fwi") && (
        <Chip title="Pronóstico FWI (ECMWF / GWIS)" src={GWIS_LEGEND_URL} alt="Escala del Índice Meteorológico de Incendio (FWI)" />
      )}
      {on("fires-landcover") && (
        <Chip
          title="Cobertura del suelo (MODIS)"
          src={GWIS_LANDCOVER_LEGEND_URL}
          alt="Escala de cobertura del suelo (MODIS MCD12Q1)"
        />
      )}
      {on("ghsl") && (
        <Chip
          title="Asentamientos humanos (GHSL)"
          src={GWIS_SETTLEMENT_LEGEND_URL}
          alt="Leyenda de asentamientos humanos (GHSL Built-Up)"
        />
      )}
      {on("wdpa") && (
        <Chip
          title="Áreas protegidas (WDPA)"
          src={GWIS_PROTECTED_AREAS_LEGEND_URL}
          alt="Leyenda de áreas protegidas (WDPA)"
        />
      )}
      {on("osm-infra") && <OsmInfraLegend />}
    </>
  )
}

function PrecipitacionConventions() {
  return (
    <LegendSection title="Popup de precipitación">
      <Note>Condiciones actuales, nivel de acumulado a 7 días y pronóstico diario.</Note>
      <Note>
        <span className="font-medium text-foreground">POP %</span> = probabilidad de precipitación del día; el
        número en mm es la lluvia esperada.
      </Note>
      <Note>Umbrales orientativos (WMO/AMS escalados a 7 días); no son un modelo calibrado de amenaza.</Note>
    </LegendSection>
  )
}

function ClimaConventions() {
  return (
    <LegendSection title="Marcadores">
      <Note>Icono = condición actual; número grande = temperatura; número pequeño = sensación térmica.</Note>
      <Note>Al acercar el zoom aparecen más veredas. Clic en el mapa para el pronóstico a 3-4 días.</Note>
    </LegendSection>
  )
}

function HidrantesConventions() {
  return (
    <>
      <LegendSection title="Hidrantes">
        <LegendRow round color="#dc2626" label="Hidrante" />
        <LegendRow round color="#f59e0b" label="Más cercano en línea recta" />
        <LegendRow round color="#16a34a" label="Más rápido a pie" />
        <LegendRow round color="#7c3aed" label="Seleccionado" />
        <LegendRow round color="#3b82f6" label="Tu ubicación / punto elegido" />
      </LegendSection>
      <LegendSection title="Rutas">
        <LegendLine color="#f59e0b" thick label="Ruta al más cercano" />
        <LegendLine color="#16a34a" thick label="Ruta más rápida a pie" />
        <LegendLine color="#7c3aed" thick label="Ruta al seleccionado" />
        <LegendLine color="#6b7280" thick dashed label="Trazo discontinuo = línea recta (sin calles)" />
      </LegendSection>
      <LegendSection title="Cobertura de hidrantes">
        <li>
          <div
            className="h-2 w-full rounded-full"
            style={{ background: "linear-gradient(90deg, #dc2626, #f97316, #eab308, #84cc16, #16a34a)" }}
            aria-hidden="true"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Aislado</span>
            <span>Bien cubierto</span>
          </div>
        </li>
        <Note>
          Radio de {COVERAGE_RADIUS_DEFAULT_M} m ({COVERAGE_RADIUS_TIGHT_M} m cerca de sitios sensibles). Se activa con
          &ldquo;Mostrar cobertura&rdquo;.
        </Note>
      </LegendSection>
    </>
  )
}

/**
 * The "Convenciones" block every layer shows below its level legend: how to
 * read the map (encoding + units), the symbols particular to that layer, and
 * the legend of every context overlay currently switched on.
 */
export function LayerConventions({
  layer,
  subLayerToggles,
}: {
  layer: LayerKey
  subLayerToggles: Record<string, boolean>
}) {
  return (
    <>
      {layer === "precipitacion" && <PrecipitacionConventions />}
      {layer === "clima" && <ClimaConventions />}
      {layer === "hidrantes" && <HidrantesConventions />}
      <SubLayerConventions layer={layer} subLayerToggles={subLayerToggles} />
    </>
  )
}
