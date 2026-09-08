import { redirect } from "next/navigation"

// Incendios now lives on the homepage as one of the three hazard workspace
// panels — redirect old links/bookmarks there.
export default function FirePage() {
  redirect("/?categoria=incendios")
}
