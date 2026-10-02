"use client"

import { ChevronUp } from "lucide-react"

/**
 * Mobile-only (`lg:hidden`), always-on floating affordance back to the very
 * top of the page. Every hazard map captures touch drag to pan/zoom itself,
 * so once a user has scrolled past the first fold there's no reliable way
 * to drag the page back up without first finding empty space outside the
 * map — this button is a fixed, permanent escape hatch that works from
 * anywhere on the page, regardless of which category is active or how far
 * down its content runs.
 *
 * Rendered once at the `HazardWorkspace` level (not per-panel) so it stays
 * mounted across category switches instead of resetting with each panel.
 */
export function MobileScrollTopButton() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba de la página"
      className="fixed bottom-4 right-4 z-40 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
    >
      <ChevronUp className="size-5" aria-hidden="true" />
    </button>
  )
}
