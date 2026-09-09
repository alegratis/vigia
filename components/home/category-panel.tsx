"use client"

import Image from "next/image"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MapModel } from "@/lib/maps"

interface CategoryPanelProps {
  model: MapModel
  icon: LucideIcon
  isActive: boolean
  onActivate: () => void
  children: React.ReactNode
}

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
 */
export function CategoryPanel({ model, icon: Icon, isActive, onActivate, children }: CategoryPanelProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden transition-[flex-grow,flex-basis] duration-500 ease-in-out",
        isActive ? "grow shrink basis-0" : "grow-0 shrink-0 basis-20 xl:basis-24",
      )}
    >
      {isActive ? (
        <div className="flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-left-2 duration-300">
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
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
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
