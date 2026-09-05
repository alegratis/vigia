"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Leaflet reads `window` at module load time, so the map itself can only be
 * imported on the client. This loader is the single entry point pages/other
 * components should use.
 */
export const GeoglowsLiveMapLoader = dynamic(() => import("@/components/maps/geoglows-live-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[420px] w-full rounded-xl" />,
})
