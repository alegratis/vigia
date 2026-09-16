"use client"

import { useEffect, useMemo, useState } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldLabel } from "@/components/ui/field"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { DEPARTAMENTOS, getMunicipioByCode, getMunicipiosByDepartamento } from "@/lib/lugares/registry"
import { useSelectedPlace } from "@/lib/lugares/use-selected-place"
import { useVeredaList } from "@/lib/veredas/use-vereda-list"
import { ExposicionMapLoader } from "@/components/maps/exposicion-map-loader"

/**
 * Departamento → Municipio → Vereda picker for the "Conoce tu nivel de
 * exposición" popup (see app/exposicion/popup/page.tsx). Nationwide: the
 * municipio choice drives the shared SelectedPlaceProvider, which reframes
 * the focused map and reloads the vereda list for that municipio. The
 * vereda dropdown depends on the municipio one and resets whenever the
 * municipio changes. The popup seeds its initial municipio from `?mun=`
 * (whatever the user had selected on the homepage).
 */
export function ExposicionPanel() {
  const { region, effectiveCode, setMunicipioCode } = useSelectedPlace()
  const { veredas, isLoading, error } = useVeredaList()
  const [codigoVereda, setCodigoVereda] = useState<string>("")

  // The department shown follows the selected municipio; start from it.
  const selectedMunicipio = getMunicipioByCode(effectiveCode)
  const [depCode, setDepCode] = useState<string>(selectedMunicipio?.depCode ?? "76")

  const municipios = useMemo(() => getMunicipiosByDepartamento(depCode), [depCode])

  // The vereda list is already scoped to the selected municipio by the API.
  const selectedVereda = useMemo(
    () => veredas?.find((v) => v.codigoVereda === codigoVereda) ?? null,
    [veredas, codigoVereda],
  )

  // Reset the dependent vereda selection whenever the municipio changes.
  useEffect(() => {
    setCodigoVereda("")
  }, [effectiveCode])

  function handleDepChange(nextDep: string) {
    setDepCode(nextDep)
    // Always resolve to a concrete municipio: the department's first.
    setMunicipioCode(getMunicipiosByDepartamento(nextDep)[0]?.code ?? null)
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-col gap-4 border-b border-border px-4 py-6 sm:px-6 print:hidden">
        <div>
          <h1 className="text-balance text-xl font-semibold tracking-tight">Conoce tu nivel de exposición</h1>
          <p className="mt-1 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Elige tu departamento, municipio y vereda para ver un mapa enfocado con las amenazas que monitorea Vigía y
            su pronóstico más reciente.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Field className="sm:w-52">
            <FieldLabel htmlFor="departamento-select">Departamento</FieldLabel>
            <Select value={depCode} onValueChange={(value) => value && handleDepChange(value)}>
              <SelectTrigger id="departamento-select" className="w-full">
                <SelectValue placeholder="Selecciona un departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {DEPARTAMENTOS.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field className="sm:w-52">
            <FieldLabel htmlFor="municipio-select">Municipio</FieldLabel>
            <Select value={effectiveCode} onValueChange={(value) => value && setMunicipioCode(value)}>
              <SelectTrigger id="municipio-select" className="w-full">
                <SelectValue placeholder="Selecciona un municipio" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {municipios.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field className="sm:w-64">
            <FieldLabel htmlFor="vereda-select">Vereda</FieldLabel>
            <Select
              value={codigoVereda}
              onValueChange={(value) => setCodigoVereda(value ?? "")}
              disabled={isLoading || !veredas || veredas.length === 0}
            >
              <SelectTrigger id="vereda-select" className="w-full">
                <SelectValue>
                  {/*
                    The Select's value is the vereda's code (needed for the
                    dependent-vereda lookup), so this resolves it back to the
                    vereda's name instead of showing the raw code — falling
                    back to a status-aware placeholder.
                  */}
                  {(value: string | null) =>
                    value
                      ? veredas?.find((v) => v.codigoVereda === value)?.nombre
                      : isLoading
                        ? "Cargando veredas…"
                        : !veredas || veredas.length === 0
                          ? "Sin veredas para este municipio"
                          : "Selecciona una vereda"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(veredas ?? []).map((v) => (
                    <SelectItem key={v.codigoVereda} value={v.codigoVereda}>
                      {v.nombre}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </header>

      <div className="flex-1">
        {selectedVereda ? (
          <ExposicionMapLoader vereda={selectedVereda} />
        ) : (
          <Empty className="h-full">
            <EmptyMedia variant="icon">{isLoading ? <Spinner /> : null}</EmptyMedia>
            <EmptyTitle>
              {error ? "No se pudo cargar la lista de veredas" : `Selecciona una vereda en ${region.municipioName}`}
            </EmptyTitle>
            <EmptyDescription>
              {error
                ? "Intenta cerrar esta ventana y abrirla de nuevo."
                : "El mapa enfocado con las amenazas aparecerá aquí una vez elijas tu municipio y vereda."}
            </EmptyDescription>
          </Empty>
        )}
      </div>
    </div>
  )
}
