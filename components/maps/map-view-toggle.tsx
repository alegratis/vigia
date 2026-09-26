"use client"

import { Box, Square } from "lucide-react"
import { cn } from "@/lib/utils"

interface MapViewToggleProps {
  is3D: boolean
  onToggle: () => void
  className?: string
}

/**
 * Floating 2D/3D toggle shared by every MapLibre-based hazard map. Purely a
 * pitch/bearing convenience for now — flips the map into a tilted
 * perspective (and back to top-down) via the caller's own `easeTo` handler,
 * with no effect on which layers or data are shown.
 */
export function MapViewToggle({ is3D, onToggle, className }: MapViewToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={is3D}
      aria-label={is3D ? "Cambiar a vista 2D" : "Cambiar a vista 3D"}
      className={cn(
        "absolute z-[400] flex items-center gap-1.5 rounded-md border border-border bg-card/80 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-card",
        className,
      )}
    >
      {is3D ? <Box className="size-3.5" aria-hidden="true" /> : <Square className="size-3.5" aria-hidden="true" />}
      {is3D ? "3D" : "2D"}
    </button>
  )
}
