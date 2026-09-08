"use client"

import { useEffect, useMemo, useState } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Field, FieldLabel } from "@/components/ui/field"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { useVeredaList } from "@/lib/veredas/use-vereda-list"
import { ExposicionMapLoader } from "@/components/maps/exposicion-map-loader"

const MUNICIPIOS = ["Sevilla", "Caicedonia", "Zarzal"]

/**
 * Municipio → vereda picker for the "Conoce tu nivel de exposición" popup
 * (see app/exposicion/popup/page.tsx). Drives a focused map (below) that
 * fits to the selected vereda's boundary and overlays all three hazards.
 * The vereda dropdown is dependent on the municipio one — it only lists
 * veredas belonging to whichever municipio is currently selected, and
 * resets whenever the municipio changes.
 */
export function ExposicionPanel() {
  const { veredas, isLoading, error } = useVeredaList()
  const [municipio, setMunicipio] = useState<string>("")
  const [codigoVereda, setCodigoVereda] = useState<string>("")

  const veredasForMunicipio = useMemo(
    () => veredas?.filter((v) => v.municipio === municipio) ?? [],
    [veredas, municipio],
  )

  const selectedVereda = useMemo(
    () => veredasForMunicipio.find((v) => v.codigoVereda === codigoVereda) ?? null,
    [veredasForMunicipio, codigoVereda],
  )

  // Reset the dependent vereda selection whenever the municipio changes.
  useEffect(() => {
    setCodigoVereda("")
  }, [municipio])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-col gap-4 border-b border-border px-4 py-6 sm:px-6 print:hidden">
        <div>
          <h1 className="text-balance text-xl font-semibold tracking-tight">Conoce tu nivel de exposición</h1>
          <p className="mt-1 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Elige tu municipio y vereda para ver un mapa enfocado con las cuatro amenazas que monitorea Vigía y su
            pronóstico más reciente.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Field className="sm:w-52">
            <FieldLabel htmlFor="municipio-select">Municipio</FieldLabel>
            <Select value={municipio} onValueChange={(value) => setMunicipio(value ?? "")}>
              <SelectTrigger id="municipio-select" className="w-full">
                <SelectValue placeholder="Selecciona un municipio" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MUNICIPIOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
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
              disabled={!municipio}
            >
              <SelectTrigger id="vereda-select" className="w-full">
                <SelectValue>
                  {/*
                    The Select's value is the vereda's code (needed for the
                    dependent-vereda lookup), so this resolves it back to the
                    vereda's name instead of showing the raw code — falling
                    back to the same placeholder copy used before any
                    municipio/vereda is picked.
                  */}
                  {(value: string | null) =>
                    value
                      ? veredasForMunicipio.find((v) => v.codigoVereda === value)?.nombre
                      : !municipio
                        ? "Primero elige un municipio"
                        : isLoading
                          ? "Cargando veredas…"
                          : "Selecciona una vereda"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {veredasForMunicipio.map((v) => (
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
            <EmptyTitle>{error ? "No se pudo cargar la lista de veredas" : "Selecciona una vereda"}</EmptyTitle>
            <EmptyDescription>
              {error
                ? "Intenta cerrar esta ventana y abrirla de nuevo."
                : "El mapa enfocado con las cuatro amenazas aparecerá aquí una vez elijas tu municipio y vereda."}
            </EmptyDescription>
          </Empty>
        )}
      </div>
    </div>
  )
}
