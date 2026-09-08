"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { VeredaListEntry } from "@/lib/veredas/list-api-types"

/**
 * Leaflet reads `window` at module load time, so the map itself can only be
 * imported on the client. This loader is the single entry point
 * components/exposicion/exposicion-panel.tsx should use.
 */
const ExposicionMapImpl = dynamic(() => import("@/components/maps/exposicion-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[420px] w-full" />,
})

export function ExposicionMapLoader({ vereda }: { vereda: VeredaListEntry }) {
  return <ExposicionMapImpl vereda={vereda} />
}
