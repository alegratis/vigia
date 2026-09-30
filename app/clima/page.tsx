import { redirect } from "next/navigation"

// Clima lives on the homepage as one of the hazard workspace panels —
// redirect old links/bookmarks there.
export default function ClimaPage() {
  redirect("/?categoria=clima")
}
