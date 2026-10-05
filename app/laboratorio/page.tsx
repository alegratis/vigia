import type { Metadata } from "next"
import { LabWorkspace } from "@/components/laboratorio/lab-workspace"

export const metadata: Metadata = {
  title: "Laboratorio · Vigía",
  description:
    "Prototipo de mapa único multicapa: Deslizamientos, Inundaciones e Incendios combinados sobre el mismo lienzo, con detección de conflicto visual, vista 3D y estado compartible por URL.",
}

/**
 * Minimal server shell for the `/laboratorio` prototype (see
 * v0_plans/grand-method.md) — all state and interactivity live in the
 * client-only `LabWorkspace`. Additive route: does not touch `/` or any of
 * the production per-category workspaces.
 */
export default function LaboratorioPage() {
  return <LabWorkspace />
}
