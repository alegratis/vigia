import { redirect } from "next/navigation"

// Riesgo compuesto lives on the homepage as one of the hazard workspace
// panels — redirect old links/bookmarks there.
export default function RiesgoCompuestoPage() {
  redirect("/?categoria=riesgo-compuesto")
}
