import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LabWorkspace } from "@/components/laboratorio/lab-workspace"

export const metadata: Metadata = {
  title: "Vigía",
  description:
    "Mapa multicapa de amenazas naturales y vulnerabilidad social: deslizamientos, inundaciones, incendios y más sobre el mismo lienzo, con detección de conflicto visual, vista 3D y estado compartible por URL.",
}

const LEGACY_LAYER_SLUGS = new Set([
  "deslizamientos",
  "inundaciones",
  "incendios",
  "precipitacion",
  "clima",
  "sismologia",
  "riesgo-compuesto",
  "demografia",
])

/**
 * Minimal server shell for the home page — all state and interactivity
 * live in the client-only `LabWorkspace`. Old `/?categoria=<capa>` links are
 * forwarded to the equivalent `?layers=<capa>` URL.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string | string[] }>
}) {
  const { categoria } = await searchParams
  const slug = Array.isArray(categoria) ? categoria[0] : categoria
  if (slug && LEGACY_LAYER_SLUGS.has(slug)) {
    redirect(`/?layers=${slug}`)
  }
  return <LabWorkspace />
}
