"use client"

import { useRef, useState } from "react"
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react"
import { ClimaLiveMapLoader } from "@/components/maps/clima-live-map-loader"
import { ScrollHintButton } from "@/components/home/scroll-hint-button"
import { BackToTopButton } from "@/components/home/back-to-top-button"
import { WEATHER_GROUP_LABELS } from "@/lib/clima/weather-codes"
import type { ClimaVeredaProperties, WeatherGroup } from "@/lib/clima/api-types"
import type { OsmPoint } from "@/lib/osm/api-types"
import type { MapBounds } from "@/lib/map-bounds"
import type { VeredaFeature } from "@/lib/veredas/api-types"

interface ClimaPanelContentProps {
  onBoundsChange?: (bounds: MapBounds) => void
  onZoneSelect?: (municipio: string) => void
  onVeredaFeatureSelect?: (feature: VeredaFeature | null) => void
  activeOsmPoints: OsmPoint[]
}

const DAY_ICONS: Record<WeatherGroup, LucideIcon> = {
  despejado: Sun,
  parcial: CloudSun,
  nublado: Cloud,
  niebla: CloudFog,
  llovizna: CloudDrizzle,
  lluvia: CloudRain,
  aguacero: CloudRainWind,
  tormenta: CloudLightning,
  nieve: Snowflake,
}

/** Picks the lucide icon for a weather group, swapping the clear-sky glyph for a moon at night. */
function WeatherGlyph({
  group,
  esDia = true,
  className,
}: {
  group: WeatherGroup
  esDia?: boolean
  className?: string
}) {
  const Icon = group === "despejado" && !esDia ? Moon : DAY_ICONS[group]
  return <Icon className={className} aria-hidden="true" />
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "America/Bogota" })

function weekdayLabel(fecha: string, index: number): string {
  if (index === 0) return "Hoy"
  // Parse as local noon to avoid a UTC-midnight date landing on the previous day.
  const label = WEEKDAY_FORMAT.format(new Date(`${fecha}T12:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "")
}

/** Detailed weather report for the clicked vereda: current conditions plus the 7-day strip. */
function WeatherReportCard({ vereda }: { vereda: ClimaVeredaProperties | null }) {
  if (!vereda) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground sm:p-6">
        Haz clic sobre cualquier vereda del mapa para ver su clima actual y el pronóstico de los próximos días.
      </div>
    )
  }

  const condicion = vereda.grupoActual ? WEATHER_GROUP_LABELS[vereda.grupoActual] : "Sin dato"

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-pretty text-base font-semibold text-foreground">{vereda.nombre}</h3>
        <p className="text-xs text-muted-foreground">{vereda.municipio}</p>
      </div>

      <div className="flex items-center gap-4">
        {vereda.grupoActual && (
          <WeatherGlyph group={vereda.grupoActual} esDia={vereda.esDia} className="size-12 shrink-0 text-primary" />
        )}
        <div className="flex flex-col">
          <span className="text-4xl font-bold tabular-nums text-foreground">
            {vereda.tempActual != null ? `${Math.round(vereda.tempActual)}°` : "—"}
          </span>
          <span className="text-sm text-muted-foreground">{condicion}</span>
          {vereda.tempMaxHoy != null && vereda.tempMinHoy != null && (
            <span className="text-xs text-muted-foreground">
              Máx {Math.round(vereda.tempMaxHoy)}° · Mín {Math.round(vereda.tempMinHoy)}°
            </span>
          )}
        </div>
      </div>

      {vereda.amenazaIncendioAjustada && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Vulnerabilidad a incendio:{" "}
          <span className="font-semibold text-foreground">{vereda.amenazaIncendioAjustada}</span>
          {vereda.incendioElevado
            ? ` — elevada desde ${vereda.amenazaIncendioBase} por una racha seca de ${vereda.rachaSeca} días prevista.`
            : `. Racha seca prevista: ${vereda.rachaSeca} día${vereda.rachaSeca === 1 ? "" : "s"}.`}
        </p>
      )}

      {vereda.dias.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {vereda.dias.map((dia, i) => (
            <div
              key={dia.fecha}
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background/50 px-1 py-2 text-center"
            >
              <span className="text-[11px] font-medium text-muted-foreground">{weekdayLabel(dia.fecha, i)}</span>
              <WeatherGlyph group={dia.grupo} className="size-5 text-foreground" />
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {dia.tempMax != null ? `${Math.round(dia.tempMax)}°` : "—"}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {dia.tempMin != null ? `${Math.round(dia.tempMin)}°` : "—"}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{dia.probabilidadLluvia}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Expanded clima panel for the homepage workspace: the vereda weather map
 * fills the first fold; below it, a detailed report card for the clicked
 * vereda (current conditions + 7-day strip) and the source caption scroll
 * in. Like precipitación, this layer covers all three municipios including
 * Zarzal. Demographics and infrastructure toggles live in the workspace's
 * shared sidebar, fed by onBoundsChange/onZoneSelect/onVeredaFeatureSelect.
 */
export function ClimaPanelContent({
  onBoundsChange,
  onZoneSelect,
  onVeredaFeatureSelect,
  activeOsmPoints,
}: ClimaPanelContentProps) {
  const captionRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const [selectedClima, setSelectedClima] = useState<ClimaVeredaProperties | null>(null)

  return (
    <div className="flex flex-col overflow-y-auto lg:min-h-0 lg:flex-1">
      <div
        ref={mapRef}
        role="region"
        aria-label="Mapa de clima"
        className="relative h-[70vh] min-h-[420px] shrink-0 lg:h-full"
      >
        <p className="sr-only">
          Mapa interactivo del estado del tiempo por vereda, con la temperatura actual y las condiciones del cielo,
          un selector para alternar entre la capa de temperatura y la de vulnerabilidad a incendios ajustada por la
          racha seca prevista, y un marcador de condiciones actuales por municipio. Al hacer clic sobre una vereda se
          muestra su pronóstico a 7 días en la tarjeta bajo el mapa. El panel de población en el encuadre actual, en la
          barra lateral, resume el mismo contenido en formato de texto.
        </p>
        <ClimaLiveMapLoader
          className="relative isolate h-full w-full"
          onBoundsChange={onBoundsChange}
          onZoneSelect={onZoneSelect}
          onVeredaFeatureSelect={onVeredaFeatureSelect}
          onClimaSelect={setSelectedClima}
          osmPoints={activeOsmPoints}
        />
        <ScrollHintButton targetRef={captionRef} label="Ver pronóstico y fuentes" />
      </div>
      <div ref={captionRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div aria-live="polite">
          <WeatherReportCard vereda={selectedClima} />
        </div>
        <p className="text-xs text-muted-foreground">
          Reporte meteorológico por vereda con datos de{" "}
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Open-Meteo
          </a>{" "}
          (temperatura, código de estado del tiempo WMO y pronóstico a 7 días, a partir de modelos numéricos de
          pronóstico del tiempo, no de observación directa). La capa de vulnerabilidad a incendio combina la amenaza
          estructural publicada por vereda (misma fuente que el mapa de Incendios, solo Sevilla y Caicedonia) con la
          racha seca prevista: cuando se prolonga la sequía, el nivel sube un escalón. Es una estimación ilustrativa y
          no forma parte del modelo de riesgo compuesto. A diferencia de la mayoría de las capas, esta cubre Zarzal con
          el mismo detalle que Sevilla y Caicedonia. Haz clic sobre cualquier vereda para ver su pronóstico completo.
        </p>
        <BackToTopButton targetRef={mapRef} />
      </div>
    </div>
  )
}
