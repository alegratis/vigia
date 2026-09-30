import { redirect } from "next/navigation"

// Demografía lives on the homepage as one of the hazard workspace panels —
// redirect old links/bookmarks there.
export default function DemografiaPage() {
  redirect("/?categoria=demografia")
}
