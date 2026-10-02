"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * MapLibre reads `window` at module load time (and this map additionally
 * calls `navigator.geolocation`), so it can only be imported on the
 * client. This loader is the single entry point other components should
 * use.
 */
export const HidrantesLiveMapLoader = dynamic(() => import("@/components/maps/hidrantes-live-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[420px] w-full rounded-xl" />,
})
