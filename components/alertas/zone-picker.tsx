"use client"

import { useMemo, useState } from "react"
import { MapPin, Search, X } from "lucide-react"
import { MAX_VEREDAS, type ZoneChoice } from "@/lib/alertas/client"
import { MUNICIPIOS } from "@/lib/alertas/municipios"

export interface VeredaOption {
  code: string
  name: string
  municipio: string
  urbano?: boolean
}

interface ZonePickerProps {
  zones: ZoneChoice[]
  onChange: (zones: ZoneChoice[]) => void
  veredas: VeredaOption[]
}

const MAX_RESULTS = 6

function zoneKey(z: ZoneChoice) {
  return `${z.municipioCode}:${z.veredaCode ?? ""}`
}

export function ZonePicker({ zones, onChange, veredas }: ZonePickerProps) {
  const [query, setQuery] = useState("")
  const veredaCount = zones.filter((z) => z.veredaCode).length

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const selected = new Set(zones.map((z) => z.veredaCode))
    return veredas
      .filter((v) => !selected.has(v.code) && `${v.name} ${v.municipio}`.toLowerCase().includes(q))
      .sort((a, b) => Number(Boolean(b.urbano)) - Number(Boolean(a.urbano)))
      .slice(0, MAX_RESULTS)
  }, [query, veredas, zones])

  const toggleMunicipio = (code: string, name: string) => {
    const exists = zones.some((z) => z.municipioCode === code && !z.veredaCode)
    onChange(
      exists
        ? zones.filter((z) => !(z.municipioCode === code && !z.veredaCode))
        : [...zones, { municipioCode: code, municipioName: name, veredaCode: null, veredaName: null }],
    )
  }

  const addVereda = (v: VeredaOption) => {
    const municipio = MUNICIPIOS.find((m) => m.name === v.municipio)
    if (!municipio || veredaCount >= MAX_VEREDAS) return
    onChange([
      ...zones,
      { municipioCode: municipio.code, municipioName: municipio.name, veredaCode: v.code, veredaName: v.name },
    ])
    setQuery("")
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Municipio completo</legend>
        <div className="flex flex-wrap gap-2">
          {MUNICIPIOS.map((m) => {
            const active = zones.some((z) => z.municipioCode === m.code && !z.veredaCode)
            return (
              <button
                key={m.code}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMunicipio(m.code, m.name)}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground"
              >
                {m.name}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="vereda-search" className="text-sm font-medium text-foreground">
          O una vereda o casco urbano específico
          <span className="ml-1 font-normal text-muted-foreground">
            ({veredaCount}/{MAX_VEREDAS})
          </span>
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="vereda-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={veredaCount >= MAX_VEREDAS}
            placeholder={veredas.length === 0 ? "Cargando veredas…" : "Vereda, o escriba casco urbano"}
            autoComplete="off"
            className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
        {results.length > 0 && (
          <ul className="flex flex-col overflow-hidden rounded-md border border-border">
            {results.map((v) => (
              <li key={v.code}>
                <button
                  type="button"
                  onClick={() => addVereda(v)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="truncate">{v.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{v.municipio}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && results.length === 0 && veredas.length > 0 && (
          <p className="text-xs text-muted-foreground">No hay veredas con ese nombre.</p>
        )}
      </div>

      {zones.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Zonas elegidas">
          {zones.map((z) => (
            <li
              key={zoneKey(z)}
              className="flex items-center gap-1.5 rounded-full bg-accent py-1 pr-1 pl-2.5 text-xs text-accent-foreground"
            >
              <MapPin className="size-3" aria-hidden="true" />
              {z.veredaName ? `${z.veredaName} · ${z.municipioName}` : `${z.municipioName} (todo)`}
              <button
                type="button"
                onClick={() => onChange(zones.filter((x) => zoneKey(x) !== zoneKey(z)))}
                aria-label={`Quitar ${z.veredaName ?? z.municipioName}`}
                className="flex size-5 items-center justify-center rounded-full hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
