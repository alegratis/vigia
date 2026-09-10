import { redirect } from "next/navigation"

// Sismología lives on the homepage as one of the hazard workspace panels —
// redirect old links/bookmarks there.
export default function SismologiaPage() {
  redirect("/?categoria=sismologia")
}
