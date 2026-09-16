"use client"

import { useId, useMemo, useState } from "react"
import { MapPin } from "lucide-react"
import {
  DEPARTAMENTOS,
  getMunicipioByCode,
  getMunicipiosByDepartamento,
  STUDY_AREA_DEPARTAMENTO_CODE,
} from "@/lib/lugares/registry"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"

/**
 * Departamento → Ciudad dropdowns that drive the nationally-selected
 * municipio. Selecting a municipio reframes every map and reloads its vereda
 * layer + models for that place. Within Valle del Cauca a first option
 * restores the original three-municipio study area (the null selection).
 */
export function PlaceSelector({ className }: { className?: string }) {
  const { municipioCode, setMunicipioCode } = useSelectedPlace()
  const depSelectId = useId()
  const munSelectId = useId()

  // Derive the department shown from the current selection; default to the
  // study area's departamento (Valle del Cauca) when nothing is selected.
  const selectedMunicipio = getMunicipioByCode(municipioCode)
  const [depCode, setDepCode] = useState<string>(selectedMunicipio?.depCode ?? STUDY_AREA_DEPARTAMENTO_CODE)

  const municipios = useMemo(() => getMunicipiosByDepartamento(depCode), [depCode])
  const isStudyAreaDep = depCode === STUDY_AREA_DEPARTAMENTO_CODE

  function handleDepChange(nextDep: string) {
    setDepCode(nextDep)
    // Valle del Cauca reverts to the study-area default; other departments
    // auto-select their first municipio so a place is always resolved.
    if (nextDep === STUDY_AREA_DEPARTAMENTO_CODE) setMunicipioCode(null)
    else setMunicipioCode(getMunicipiosByDepartamento(nextDep)[0]?.code ?? null)
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
            value={municipioCode ?? ""}
            onChange={(e) => setMunicipioCode(e.target.value || null)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isStudyAreaDep && <option value="">Área de estudio (3 municipios)</option>}
            {!isStudyAreaDep && municipioCode === null && (
              <option value="" disabled>
                Selecciona un municipio
              </option>
            )}
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
