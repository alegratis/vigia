"use client"

import { MapPin } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StationDetail } from "@/components/flood/station-detail"
import type { Station } from "@/lib/geoglows/stations"

/**
 * In-place forecast detail for a river station: everything the old
 * `/inundaciones/[slug]` standalone page showed (metrics, hydrograph,
 * return-period table via StationDetail), but opened as a dialog over the
 * current workspace instead of navigating away from it. Used by both the
 * live map's reach popups and the FloodOverview station cards.
 */
export function StationDetailDialog({
  station,
  onOpenChange,
}: {
  station: Station | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={station != null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {station && (
          <>
            <DialogHeader className="shrink-0 gap-1 border-b border-border px-6 py-5 text-left">
              <span className="text-sm font-medium text-muted-foreground">{station.river}</span>
              <DialogTitle className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                {station.name}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {station.municipality}, {station.department}
                </span>
                <span className="tabular-nums">Tramo GEOGLOWS #{station.reachId}</span>
              </DialogDescription>
              {station.note && (
                <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                  {station.note}
                </p>
              )}
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <StationDetail reachId={station.reachId} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
