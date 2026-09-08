import { redirect } from "next/navigation"

// Precipitación lives on the homepage as one of the four hazard workspace
// panels — redirect old links/bookmarks there.
export default function PrecipitacionPage() {
  redirect("/?categoria=precipitacion")
}
