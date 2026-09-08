"use client"

import { ChevronDown } from "lucide-react"

interface ScrollHintButtonProps {
  targetRef: React.RefObject<HTMLElement | null>
  label: string
}

/**
 * Floating affordance pinned to the bottom of a map that fills the first
 * fold. The map captures the scroll wheel to zoom, so it's not obvious
 * there's more content below — this gives an explicit click target that
 * smooth-scrolls to it. It lives inside the map's own (fixed-height)
 * wrapper, so it scrolls away with the map once the user passes it rather
 * than staying pinned over the content it reveals.
 */
export function ScrollHintButton({ targetRef, label }: ScrollHintButtonProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[500] flex justify-center">
      <button
        type="button"
        onClick={() => targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-background/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg ring-1 ring-border backdrop-blur transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
