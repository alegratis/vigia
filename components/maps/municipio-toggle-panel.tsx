"use client"

import { useEffect, useState } from "react"
import { MUNICIPIOS } from "@/lib/veredas/municipio-toggles"
import { resolveCssColor } from "@/lib/resolve-css-color"

export interface MunicipioRiskItem {
  label: string
  value: string
  /** Optional CSS color token for a leading swatch (e.g. a hazard-level color). */
  colorToken?: string
}

export interface MunicipioRiskSummary {
  municipio: string
  items: MunicipioRiskItem[]
}

interface MunicipioTogglePanelProps {
  active: Record<string, boolean>
  onToggle: (municipio: string) => void
  /** Per-active-municipio risk factors, shown beneath its toggle. */
  summaries?: MunicipioRiskSummary[]
  /** Heading for the risk block, e.g. "Susceptibilidad a deslizamiento". */
  riskTitle?: string
}

function Swatch({ colorToken }: { colorToken: string }) {
  const [color, setColor] = useState<string | null>(null)
  useEffect(() => {
    setColor(resolveCssColor(colorToken))
  }, [colorToken])
  return (
    <span
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "transparent" }}
      aria-hidden="true"
    />
  )
}

/**
 * Shared municipality control shown on every hazard map: an independent
 * on/off toggle per study-area municipality (Sevilla, Caicedonia, Zarzal),
 * each highlighting that municipality's veredas on the map and listing its
 * risk factors below the toggle. Positioned top-center so it clears the
 * per-map layer controls (top-left) and zoom/legends (top-right).
 */
export function MunicipioTogglePanel({ active, onToggle, summaries, riskTitle }: MunicipioTogglePanelProps) {
  const summaryByMunicipio = new Map((summaries ?? []).map((s) => [s.municipio, s]))

  return (
    <div className="absolute left-1/2 top-3 z-[400] w-60 max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-foreground">Municipios</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {MUNICIPIOS.map((municipio) => (
          <label key={municipio} className="flex items-center gap-1.5 font-medium text-foreground">
            <input
              type="checkbox"
              checked={active[municipio] ?? false}
              onChange={() => onToggle(municipio)}
              className="size-3.5 accent-primary"
            />
            {municipio}
          </label>
        ))}
      </div>
      {summaries && summaries.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
          {riskTitle && <p className="font-medium text-muted-foreground">{riskTitle}</p>}
          {MUNICIPIOS.filter((m) => active[m]).map((municipio) => {
            const summary = summaryByMunicipio.get(municipio)
            return (
              <div key={municipio} className="flex flex-col gap-0.5">
                <p className="font-medium text-foreground">{municipio}</p>
                {summary && summary.items.length > 0 ? (
                  <ul className="flex flex-col gap-0.5">
                    {summary.items.map((item) => (
                      <li
                        key={item.label}
                        className="flex items-center justify-between gap-2 text-muted-foreground"
                      >
                        <span className="flex items-center gap-1.5">
                          {item.colorToken && <Swatch colorToken={item.colorToken} />}
                          {item.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Sin datos disponibles</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
