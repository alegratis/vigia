import { headers } from "next/headers"
import { HomeTopBar } from "@/components/home/home-top-bar"
import { HazardWorkspace } from "@/components/home/hazard-workspace"
import { mapModels } from "@/lib/maps"
import { detectOtherMunicipio } from "@/lib/demografia/geo-detect"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams
  const initialCategory = mapModels.some((m) => m.slug === categoria) ? categoria! : mapModels[0].slug

  // Vercel's edge network injects the visitor's coarse IP-geolocation as
  // request headers — see lib/demografia/geo-detect.ts for how these
  // resolve to a Demografía default view. Falls back to Sevilla whenever
  // these headers are absent (e.g. local dev, or a proxy that strips them).
  const requestHeaders = await headers()
  const lat = Number.parseFloat(requestHeaders.get("x-vercel-ip-latitude") ?? "")
  const lon = Number.parseFloat(requestHeaders.get("x-vercel-ip-longitude") ?? "")
  const detectedMunicipio = Number.isFinite(lat) && Number.isFinite(lon) ? detectOtherMunicipio(lat, lon) : null

  return (
    // `h-screen` (a fixed 100vh) is desktop-only, matching `lg:overflow-hidden` below: that pairing is what
    // gives the desktop layout its no-scroll, viewport-clamped feel, with every hazard map filling the
    // remaining height via the min-h-0 flex chain in HazardWorkspace. On mobile, that same fixed height
    // starved the map row down to a sliver — the sidebar's natural content height plus the map row's
    // couldn't both fit in 100vh, and the flex algorithm doesn't know that only the map row should
    // shrink. `min-h-screen` instead gives mobile a floor (so short content still fills the screen) but
    // lets the page grow past it and scroll normally, which is how the sidebar already displayed, so this
    // just lets the map row size itself off its own explicit heights instead of being squeezed.
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <HomeTopBar />
      <HazardWorkspace initialCategory={initialCategory} detectedMunicipio={detectedMunicipio} />
    </div>
  )
}
