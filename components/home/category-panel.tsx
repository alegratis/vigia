"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import type { LucideIcon } from "lucide-react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MapModel } from "@/lib/maps"

interface CategoryPanelProps {
  model: MapModel
  icon: LucideIcon
  isActive: boolean
  onActivate: () => void
  children: React.ReactNode
}

/** Must match the panel's flex-basis/flex-grow transition duration below. */
const SLIDE_DURATION_MS = 500

/**
 * One accordion slot in the homepage's hazard workspace. Collapsed, it's a
 * clickable photo strip — a horizontal bar on mobile, a narrow vertical
 * column on desktop — with just an icon and rotated label. Expanded, it
 * fills the remaining width with a small header (icon, title, live badge)
 * above whatever hazard-specific content is passed as children; the header
 * doesn't scroll but the content below it does, so the map can claim the
 * full first fold and everything else (infrastructure lists, captions)
 * scrolls beneath it.
 *
 * The outer element is always the same node so its flex-grow/flex-basis
 * can transition smoothly between the two sizes — that's what produces the
 * slide-open motion when a category is activated, instead of the panel
 * instantly snapping to its new width. The collapsed/expanded views inside
 * it still mount and unmount (heavy map content only exists while active),
 * each fading in on mount so the swap doesn't feel like an abrupt cut.
 *
 * `children` (the map) is deliberately not mounted the instant a panel
 * activates: Leaflet/MapLibre measure their container's pixel size once at
 * mount, and the panel is still animating from a ~80px strip to its full
 * width at that point, so the map would compute tiles for a container size
 * that's already stale a moment later, rendering cut off or misaligned. A
 * short placeholder with a loading spinner covers the slide instead, and
 * the map only mounts once the transition has actually finished.
 */
export function CategoryPanel({ model, icon: Icon, isActive, onActivate, children }: CategoryPanelProps) {
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!isActive) {
      setMapReady(false)
      return
    }
    const timer = setTimeout(() => setMapReady(true), SLIDE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [isActive])

  return (
    <div
      className={cn(
        // min-h-0 and (for the active state) basis-0/grow are lg-only, mirroring the map row above: they
        // depend on an ancestor with a definite, clamped height (desktop's h-screen) to have any space to
        // grow into. On mobile that clamp doesn't exist, so this panel is sized off its own content
        // instead — basis-auto (the default) plus the active map's explicit h-[70vh] achieves the same
        // "map fills the first fold" result without a flex-grow chain that has nothing to grow against.
        "relative flex flex-col overflow-hidden transition-[flex-grow,flex-basis] duration-500 ease-in-out lg:min-h-0",
        isActive ? "shrink basis-auto lg:grow lg:basis-0" : "grow-0 shrink-0 basis-20 xl:basis-24",
      )}
    >
      {isActive ? (
        <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300 lg:min-h-0 lg:flex-1">
          <div className="relative flex shrink-0 items-center gap-2 overflow-hidden border-b border-border px-4 py-3 sm:px-6">
            <Image
              src={model.image || "/placeholder.svg"}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 640px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-white/75 dark:bg-black/65" aria-hidden="true" />
            <Icon className="relative z-10 size-5 text-primary" aria-hidden="true" />
            <h2 className="relative z-10 text-lg font-semibold tracking-tight text-black dark:text-white">
              {model.title}
            </h2>
            {model.ready && (
              <span className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                <span className="size-1.5 rounded-full bg-[var(--chart-2)]" aria-hidden="true" />
                En vivo
              </span>
            )}
          </div>
          <div className="flex flex-col lg:min-h-0 lg:flex-1">
            {mapReady ? (
              children
            ) : (
              <div className="flex h-[70vh] min-h-[420px] shrink-0 flex-col items-center justify-center gap-2 bg-muted/40 lg:h-full">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Cargando mapa…</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Mostrar ${model.title}`}
          className="group relative flex h-full w-full items-center overflow-hidden text-left animate-in fade-in duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:flex-col lg:justify-center"
        >
          <Image
            src={model.image || "/placeholder.svg"}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 96px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div
            className="absolute inset-0 bg-white/65 transition-colors duration-300 group-hover:bg-white/50 dark:bg-black/55 dark:group-hover:bg-black/40"
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-full items-center gap-3 px-5 lg:flex-col lg:gap-4 lg:px-0">
            <Icon className="size-5 shrink-0 text-black dark:text-white" aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-wide text-black lg:[writing-mode:vertical-rl] lg:rotate-180 dark:text-white">
              {model.title}
            </span>
          </div>
        </button>
      )}
    </div>
  )
}
