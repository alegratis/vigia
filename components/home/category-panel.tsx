"use client"

import Image from "next/image"
import type { LucideIcon } from "lucide-react"
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
 */
export function CategoryPanel({ model, icon: Icon, isActive, onActivate, children }: CategoryPanelProps) {
  if (!isActive) {
    return (
      <button
        type="button"
        onClick={onActivate}
        aria-label={`Mostrar ${model.title}`}
        className="group relative flex h-20 w-full shrink-0 items-center overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset lg:h-full lg:w-20 lg:flex-col lg:justify-center xl:w-24"
      >
        <Image
          src={model.image || "/placeholder.svg"}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 96px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          className="absolute inset-0 bg-black/55 transition-colors duration-300 group-hover:bg-black/40"
          aria-hidden="true"
        />
        <div className="relative z-10 flex w-full items-center gap-3 px-5 lg:flex-col lg:gap-4 lg:px-0">
          <Icon className="size-5 shrink-0 text-white" aria-hidden="true" />
          <span className="text-sm font-semibold uppercase tracking-wide text-white lg:[writing-mode:vertical-rl] lg:rotate-180">
            {model.title}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <Icon className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold tracking-tight">{model.title}</h2>
        {model.ready && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            <span className="size-1.5 rounded-full bg-[var(--chart-2)]" aria-hidden="true" />
            En vivo
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
