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

function formatDegrees(value: number | null): string {
  return value != null ? `${Math.round(value)}°` : "—"
}

function formatMm(mm: number): string {
  return `${mm.toFixed(mm < 10 ? 1 : 0)} mm`
}

/** Index of the day with the extreme value of `pick`, ignoring days without data. Returns -1 when none have data. */
function extremeDayIndex(dias: ClimaDay[], pick: (dia: ClimaDay) => number | null, mode: "max" | "min"): number {
  let best = -1
  let bestValue = mode === "max" ? -Infinity : Infinity
  dias.forEach((dia, i) => {
    const value = pick(dia)
    if (value == null) return
    if (mode === "max" ? value > bestValue : value < bestValue) {
      best = i
      bestValue = value
    }
  })
  return best
}

interface ForecastStat {
  label: string
  value: string
  detail?: string
}

/** Summary figures derived from the 7-day forecast: dry spell, next rain, accumulated rainfall, extremes. */
function buildForecastStats(vereda: ClimaVeredaProperties): ForecastStat[] {
  const { dias, rachaSeca } = vereda
  if (dias.length === 0) return []

  const totalMm = dias.reduce((sum, dia) => sum + dia.precipMm, 0)
  const rainyDays = dias.filter((dia) => !dia.seco).length
  const nextRainIndex = dias.findIndex((dia) => !dia.seco)
  const mostLikelyIndex = extremeDayIndex(dias, (dia) => dia.probabilidadLluvia, "max")
  const hottestIndex = extremeDayIndex(dias, (dia) => dia.tempMax, "max")
  const coolestIndex = extremeDayIndex(dias, (dia) => dia.tempMin, "min")
  const label = (i: number) => weekdayLabel(dias[i].fecha, i)

  const stats: ForecastStat[] = [
    {
      label: "Racha seca prevista",
      value: `${rachaSeca} día${rachaSeca === 1 ? "" : "s"}`,
      detail: rachaSeca === 0 ? "Llueve desde hoy" : "Sin lluvia desde hoy",
    },
    {
      label: "Próxima lluvia",
      value: nextRainIndex === -1 ? "Sin lluvia" : label(nextRainIndex),
      detail:
        nextRainIndex === -1
          ? `En los próximos ${dias.length} días`
          : `${formatMm(dias[nextRainIndex].precipMm)} esperados`,
    },
    {
      label: `Lluvia acumulada (${dias.length} días)`,
      value: formatMm(totalMm),
      detail: `${rainyDays} día${rainyDays === 1 ? "" : "s"} con lluvia`,
    },
    {
      label: "Mayor prob. de lluvia",
      value: mostLikelyIndex === -1 ? "—" : `${dias[mostLikelyIndex].probabilidadLluvia}%`,
      detail: mostLikelyIndex === -1 ? undefined : label(mostLikelyIndex),
    },
  ]

  if (hottestIndex !== -1) {
    stats.push({ label: "Día más cálido", value: formatDegrees(dias[hottestIndex].tempMax), detail: label(hottestIndex) })
  }
  if (coolestIndex !== -1) {
    stats.push({ label: "Día más fresco", value: formatDegrees(dias[coolestIndex].tempMin), detail: label(coolestIndex) })
  }
  if (vereda.tempMaxHoy != null && vereda.tempMinHoy != null) {
    stats.push({
      label: "Amplitud térmica hoy",
      value: `${Math.round(vereda.tempMaxHoy - vereda.tempMinHoy)}°`,
      detail: `${formatDegrees(vereda.tempMinHoy)} a ${formatDegrees(vereda.tempMaxHoy)}`,
    })
  }
  if (vereda.sensacionTermica != null && vereda.tempActual != null) {
    const diff = Math.round(vereda.sensacionTermica - vereda.tempActual)
    stats.push({
      label: "Sensación vs. real",
      value: diff === 0 ? "Igual" : `${diff > 0 ? "+" : ""}${diff}°`,
      detail: diff === 0 ? "Sin diferencia" : diff > 0 ? "Se siente más calor" : "Se siente más fresco",
    })
  }
  return stats
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

/** Full-width weather report for the clicked vereda: current conditions, forecast-derived figures and the 7-day outlook. */
export function WeatherReportCard({ vereda }: { vereda: ClimaVeredaProperties | null }) {
  if (!vereda) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground sm:p-6">
        Haz clic sobre cualquier vereda del mapa para ver su clima actual y el pronóstico de los próximos días.
      </div>
    )
  }

  const condicion = vereda.grupoActual ? WEATHER_GROUP_LABELS[vereda.grupoActual] : "Sin dato"
  const stats = buildForecastStats(vereda)

  return (
    <section
      aria-label={`Reporte del clima para ${vereda.nombre}`}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col gap-3 lg:border-r lg:border-border lg:pr-6">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-pretty text-base font-semibold text-foreground">{vereda.nombre}</h3>
            <p className="text-xs text-muted-foreground">{vereda.municipio}</p>
          </div>
          <div className="flex items-center gap-4">
            {vereda.grupoActual && (
              <WeatherGlyph group={vereda.grupoActual} esDia={vereda.esDia} className="size-14 shrink-0 text-primary" />
            )}
            <div className="flex flex-col">
              <span className="text-5xl font-bold tabular-nums leading-none text-foreground">
                {formatDegrees(vereda.tempActual)}
              </span>
              <span className="mt-1 text-sm text-foreground">{condicion}</span>
              {vereda.sensacionTermica != null && (
                <span className="text-xs text-muted-foreground">Sensación térmica {formatDegrees(vereda.sensacionTermica)}</span>
              )}
              {vereda.tempMaxHoy != null && vereda.tempMinHoy != null && (
                <span className="text-xs text-muted-foreground">
                  Máx {formatDegrees(vereda.tempMaxHoy)} · Mín {formatDegrees(vereda.tempMinHoy)}
                </span>
              )}
            </div>
          </div>
        </div>

        {stats.length > 0 && (
          <dl className="grid content-start gap-2 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5 rounded-lg border border-border bg-background/50 px-3 py-2">
                <dt className="text-[11px] font-medium text-muted-foreground">{stat.label}</dt>
                <dd className="text-lg font-semibold tabular-nums leading-tight text-foreground">{stat.value}</dd>
                {stat.detail && <dd className="text-[11px] text-muted-foreground">{stat.detail}</dd>}
              </div>
            ))}
          </dl>
        )}
      </div>

      {vereda.dias.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-muted-foreground">Pronóstico a {vereda.dias.length} días</h4>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {vereda.dias.map((dia, i) => (
              <li
                key={dia.fecha}
                className={`flex flex-col items-center gap-1 rounded-lg border bg-background/50 px-2 py-3 text-center ${i === 0 ? "border-primary/50" : "border-border"}`}
              >
                <span className="text-xs font-medium text-muted-foreground">{weekdayLabel(dia.fecha, i)}</span>
                <WeatherGlyph group={dia.grupo} className="size-7 text-primary" />
                <span className="text-xs text-foreground">{WEATHER_GROUP_LABELS[dia.grupo]}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatDegrees(dia.tempMax)}
                  <span className="font-normal text-muted-foreground">
                    {" / "}
                    {formatDegrees(dia.tempMin)}
                  </span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Lluvia {dia.probabilidadLluvia}%
                  {dia.precipMm > 0 ? ` · ${formatMm(dia.precipMm)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
