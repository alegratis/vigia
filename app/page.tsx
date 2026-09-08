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
    <div className="flex h-screen flex-col lg:overflow-hidden">
      <HomeTopBar />
      <HazardWorkspace initialCategory={initialCategory} />
    </div>
  )
}
