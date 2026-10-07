"use client"

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
import { WEATHER_GROUP_LABELS } from "@/lib/clima/weather-codes"
import type { ClimaDay, ClimaVeredaProperties, WeatherGroup } from "@/lib/clima/api-types"

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
export function WeatherGlyph({
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

/** The 7-day strip on its own — reused by the report card and by compact surfaces such as the laboratorio side panel. */
export function WeatherForecastStrip({
  dias,
  className = "grid grid-cols-4 gap-2 sm:grid-cols-7",
  compact = false,
}: {
  dias: ClimaDay[]
  className?: string
  compact?: boolean
}) {
  return (
    <div className={className}>
      {dias.map((dia, i) => (
        <div
          key={dia.fecha}
          className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background/50 px-1 py-2 text-center"
        >
          <span className="text-[11px] font-medium text-muted-foreground">{weekdayLabel(dia.fecha, i)}</span>
          <WeatherGlyph group={dia.grupo} className={compact ? "size-4 text-foreground" : "size-5 text-foreground"} />
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
  )
}

/** Wide 7-day forecast with condition label, high/low, rain probability and expected rainfall per day. */
export function WeatherDetailedForecast({ vereda }: { vereda: ClimaVeredaProperties | null }) {
  if (!vereda || vereda.dias.length === 0) return null
  const condicion = vereda.grupoActual ? WEATHER_GROUP_LABELS[vereda.grupoActual] : null

  return (
    <section
      aria-label={`Pronóstico a siete días para ${vereda.nombre}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-pretty text-sm font-semibold text-foreground">
          Pronóstico a 7 días · {vereda.nombre}
          <span className="font-normal text-muted-foreground"> · {vereda.municipio}</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Ahora {vereda.tempActual != null ? `${Math.round(vereda.tempActual)}°` : "—"}
          {condicion ? ` · ${condicion}` : ""}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {vereda.dias.map((dia, i) => (
          <li
            key={dia.fecha}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background/50 px-2 py-3 text-center"
          >
            <span className="text-xs font-medium text-muted-foreground">{weekdayLabel(dia.fecha, i)}</span>
            <WeatherGlyph group={dia.grupo} className="size-7 text-primary" />
            <span className="text-xs text-foreground">{WEATHER_GROUP_LABELS[dia.grupo]}</span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {dia.tempMax != null ? `${Math.round(dia.tempMax)}°` : "—"}
              <span className="font-normal text-muted-foreground">
                {" / "}
                {dia.tempMin != null ? `${Math.round(dia.tempMin)}°` : "—"}
              </span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              Lluvia {dia.probabilidadLluvia}%
              {dia.precipMm > 0 ? ` · ${dia.precipMm.toFixed(dia.precipMm < 10 ? 1 : 0)} mm` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Compact weather tooltip for a map click: current conditions and the next four days. */
export function WeatherPopupContent({ vereda }: { vereda: ClimaVeredaProperties }) {
  const condicion = vereda.grupoActual ? WEATHER_GROUP_LABELS[vereda.grupoActual] : "Sin dato"
  const proximos = vereda.dias.slice(0, 4)

  return (
    <div className="flex w-60 flex-col gap-2 p-1">
      <div>
        <p className="text-pretty text-sm font-semibold text-foreground">{vereda.nombre}</p>
        <p className="text-xs text-muted-foreground">{vereda.municipio}</p>
      </div>
      <div className="flex items-center gap-3">
        {vereda.grupoActual && (
          <WeatherGlyph group={vereda.grupoActual} esDia={vereda.esDia} className="size-8 shrink-0 text-primary" />
        )}
        <div className="flex flex-col">
          <span className="text-2xl font-bold tabular-nums leading-none text-foreground">
            {vereda.tempActual != null ? `${Math.round(vereda.tempActual)}°` : "—"}
          </span>
          <span className="text-xs text-muted-foreground">{condicion}</span>
        </div>
      </div>
      {proximos.length > 0 && (
        <ul className="grid grid-cols-4 gap-1">
          {proximos.map((dia, i) => (
            <li
              key={dia.fecha}
              className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-background/50 px-1 py-1.5 text-center"
            >
              <span className="text-[11px] font-medium text-muted-foreground">{weekdayLabel(dia.fecha, i)}</span>
              <WeatherGlyph group={dia.grupo} className="size-4 text-foreground" />
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {dia.tempMax != null ? `${Math.round(dia.tempMax)}°` : "—"}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {dia.tempMin != null ? `${Math.round(dia.tempMin)}°` : "—"}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{dia.probabilidadLluvia}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Detailed weather report for the clicked vereda: current conditions plus the 7-day strip. */
export function WeatherReportCard({ vereda }: { vereda: ClimaVeredaProperties | null }) {
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
          {vereda.sensacionTermica != null && (
            <span className="text-xs text-muted-foreground">
              Sensación térmica {Math.round(vereda.sensacionTermica)}°
            </span>
          )}
          {vereda.tempMaxHoy != null && vereda.tempMinHoy != null && (
            <span className="text-xs text-muted-foreground">
              Máx {Math.round(vereda.tempMaxHoy)}° · Mín {Math.round(vereda.tempMinHoy)}°
            </span>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Racha seca prevista:{" "}
        <span className="font-semibold text-foreground">
          {vereda.rachaSeca} día{vereda.rachaSeca === 1 ? "" : "s"}
        </span>{" "}
        {vereda.rachaSeca === 1 ? "consecutivo sin lluvia" : "consecutivos sin lluvia"} al inicio del pronóstico.
      </p>

      {vereda.dias.length > 0 && <WeatherForecastStrip dias={vereda.dias} />}
    </div>
  )
}
