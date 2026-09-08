import { redirect } from "next/navigation"

// Inundaciones now lives on the homepage as one of the three hazard
// workspace panels — redirect old links/bookmarks there. Station detail
// pages at /inundaciones/[slug] are unaffected.
export default function FloodPage() {
  redirect("/?categoria=inundaciones")
}
