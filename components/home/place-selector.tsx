"use client"

import { useId, useMemo, useState } from "react"
import { MapPin } from "lucide-react"
import { DEPARTAMENTOS, getMunicipioByCode, getMunicipiosByDepartamento } from "@/lib/lugares/registry"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"

/**
 * Departamento → Ciudad dropdowns that drive the selected municipio.
 * Selecting a municipio reframes every map and reloads its vereda layer,
 * models, population and infrastructure for that place. The region is always
 * a single municipio — Sevilla by default.
 */
export function PlaceSelector({ className }: { className?: string }) {
  const { effectiveCode, setMunicipioCode } = useSelectedPlace()
  const depSelectId = useId()
  const munSelectId = useId()

  // Derive the department shown from the effective selection (Sevilla by default).
  const selectedMunicipio = getMunicipioByCode(effectiveCode)
  const [depCode, setDepCode] = useState<string>(selectedMunicipio?.depCode ?? "76")

  const municipios = useMemo(() => getMunicipiosByDepartamento(depCode), [depCode])

  function handleDepChange(nextDep: string) {
    setDepCode(nextDep)
    // Always resolve to a concrete municipio: pick the department's first.
    setMunicipioCode(getMunicipiosByDepartamento(nextDep)[0]?.code ?? null)
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MapPin className="size-3.5" aria-hidden="true" />
        Ubicación
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={depSelectId} className="text-xs font-medium text-muted-foreground">
            Departamento
          </label>
          <select
            id={depSelectId}
            value={depCode}
            onChange={(e) => handleDepChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {DEPARTAMENTOS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={munSelectId} className="text-xs font-medium text-muted-foreground">
            Ciudad / Municipio
          </label>
          <select
            id={munSelectId}
            value={effectiveCode}
            onChange={(e) => setMunicipioCode(e.target.value || null)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {municipios.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
