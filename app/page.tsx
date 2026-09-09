import { HomeTopBar } from "@/components/home/home-top-bar"
import { HazardWorkspace } from "@/components/home/hazard-workspace"
import { mapModels } from "@/lib/maps"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams
  const initialCategory = mapModels.some((m) => m.slug === categoria) ? categoria! : mapModels[0].slug

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
      <HazardWorkspace initialCategory={initialCategory} />
    </div>
  )
}
