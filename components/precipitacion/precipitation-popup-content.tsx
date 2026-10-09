"use client"

import { WeatherGlyph } from "@/components/clima/weather-report-card"
import { WEATHER_GROUP_LABELS } from "@/lib/clima/weather-codes"
import type { ClimaVeredaProperties } from "@/lib/clima/api-types"
import type { PrecipitacionFeatureProperties } from "@/lib/precipitacion/api-types"
import { precipitationLevelColorToken } from "@/lib/precipitacion/levels"

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "America/Bogota" })

function weekdayLabel(fecha: string, index: number): string {
  if (index === 0) return "Hoy"
  const label = WEEKDAY_FORMAT.format(new Date(`${fecha}T12:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1).replace(".", "")
}

function formatMm(mm: number): string {
  return mm < 10 ? mm.toFixed(1) : String(Math.round(mm))
}

function LevelDot({ level }: { level: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: precipitationLevelColorToken(level) }}
    />
  )
}

interface PrecipitationPopupContentProps {
  nombre: string
  municipio: string
  /** 7-day forecast level, total and max POP driving the map fill; null while it loads or when the vereda has no data. */
  precipitacion: PrecipitacionFeatureProperties | null
  /** Rainfall accumulated over the last 7 days (Open-Meteo), shown as a secondary figure; null while it loads. */
  historico: PrecipitacionFeatureProperties | null
  /** Current conditions and daily outlook for the same vereda; null while the feed loads. */
  clima: ClimaVeredaProperties | null
}

/** Map-click tooltip for the precipitación layer: current conditions, forecast level (the map color), past-week accumulation, and the daily outlook with POP%. */
export function PrecipitationPopupContent({
  nombre,
  municipio,
  precipitacion,
  historico,
  clima,
}: PrecipitationPopupContentProps) {
  const dias = clima?.dias ?? []
  const popMax =
    precipitacion?.probabilidadMax ?? (dias.length > 0 ? Math.max(...dias.map((d) => d.probabilidadLluvia)) : null)
  const maxDayMm = Math.max(1, ...dias.map((d) => d.precipMm))
  const condicion = clima?.grupoActual ? WEATHER_GROUP_LABELS[clima.grupoActual] : null

  return (
    <div className="flex w-72 flex-col gap-3 p-1">
      <div>
        <p className="text-pretty text-sm font-semibold text-foreground">{nombre}</p>
        <p className="text-xs text-muted-foreground">{municipio}</p>
      </div>

      <section aria-label="Condiciones actuales" className="flex flex-col gap-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Condiciones actuales
        </h4>
        {clima ? (
          <div className="flex items-center gap-3">
            {clima.grupoActual && (
              <WeatherGlyph group={clima.grupoActual} esDia={clima.esDia} className="size-8 shrink-0 text-primary" />
            )}
            <div className="flex flex-col">
              <span className="text-xl font-bold tabular-nums leading-none text-foreground">
                {clima.tempActual != null ? `${Math.round(clima.tempActual)}°` : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {condicion ?? "Sin dato"}
                {clima.sensacionTermica != null && ` · Sensación ${Math.round(clima.sensacionTermica)}°`}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Cargando condiciones…</p>
        )}
      </section>

      <section aria-label="Nivel de precipitación" className="flex flex-col gap-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nivel</h4>
        {precipitacion?.nivel ? (
          <p className="flex items-center gap-2 text-xs text-foreground">
            <LevelDot level={precipitacion.nivel} />
            <span className="font-semibold">{precipitacion.nivel}</span>
            {precipitacion.acumuladoMm != null && (
              <span className="text-muted-foreground">
                · {formatMm(precipitacion.acumuladoMm)} mm previstos en 7 días
                {precipitacion.diasValidos < 7 && ` (${precipitacion.diasValidos} días con datos)`}
              </span>
            )}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sin datos de pronóstico para esta vereda.</p>
        )}
        {historico?.nivel && historico.acumuladoMm != null && (
          <p className="flex items-center gap-2 text-xs text-foreground">
            <LevelDot level={historico.nivel} />
            <span className="font-semibold">{historico.nivel}</span>
            <span className="text-muted-foreground">
              · {formatMm(historico.acumuladoMm)} mm en los últimos 7 días
              {historico.diasValidos < 7 && ` (${historico.diasValidos} días con datos)`}
            </span>
          </p>
        )}
      </section>

      <section aria-label="Pronóstico a siete días" className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pronóstico 7 días
          </h4>
          {popMax != null && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              POP máx. <span className="font-semibold text-foreground">{popMax}%</span>
            </span>
          )}
        </div>
        {dias.length > 0 ? (
          <ul className="grid grid-cols-7 gap-1">
            {dias.map((dia, i) => (
              <li
                key={dia.fecha}
                className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-background/50 px-0.5 py-1.5 text-center"
              >
                <span className="text-[10px] font-medium text-muted-foreground">{weekdayLabel(dia.fecha, i)}</span>
                <WeatherGlyph group={dia.grupo} className="size-3.5 text-foreground" />
                <div className="flex h-8 w-full items-end justify-center" aria-hidden="true">
                  <div
                    className="w-2.5 rounded-sm bg-primary"
                    style={{ height: `${Math.max(dia.precipMm > 0 ? 8 : 2, (dia.precipMm / maxDayMm) * 100)}%`, opacity: dia.precipMm > 0 ? 1 : 0.3 }}
                  />
                </div>
                <span className="text-[10px] font-semibold tabular-nums text-foreground">
                  {dia.precipMm > 0 ? formatMm(dia.precipMm) : "0"}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{dia.probabilidadLluvia}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Cargando pronóstico…</p>
        )}
        {dias.length > 0 && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Barras y cifras en mm por día; el porcentaje es la probabilidad de lluvia (POP).
          </p>
        )}
      </section>
    </div>
  )
}
