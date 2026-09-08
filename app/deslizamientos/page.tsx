import { redirect } from "next/navigation"

// Deslizamientos now lives on the homepage as one of the three hazard
// workspace panels — redirect old links/bookmarks there.
export default function LandslidesPage() {
  redirect("/?categoria=deslizamientos")
}
