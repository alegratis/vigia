"use client"

import { ChevronUp } from "lucide-react"

interface BackToTopButtonProps {
  targetRef: React.RefObject<HTMLElement | null>
  label?: string
}

/**
 * Companion to ScrollHintButton, placed at the bottom of a panel's scrolled-in
 * content. Smooth-scrolls back up to the map that fills the first fold, so a
 * user who has scrolled through a long caption or overview grid doesn't have
 * to scroll-wheel or drag their way back past it manually.
 */
export function BackToTopButton({ targetRef, label = "Volver al mapa" }: BackToTopButtonProps) {
  return (
    <div className="flex justify-center pt-2">
      <button
        type="button"
        onClick={() => targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="inline-flex items-center gap-1.5 rounded-full bg-background px-4 py-2 text-xs font-medium text-foreground shadow-sm ring-1 ring-border transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronUp className="size-3.5" aria-hidden="true" />
        {label}
      </button>
    </div>
  )
}
