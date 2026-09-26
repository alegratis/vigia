"use client"

import Image from "next/image"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MapModel } from "@/lib/maps"

interface CategoryTabProps {
  model: MapModel
  icon: LucideIcon
  isActive: boolean
  onActivate: () => void
  /** Continuous px values from `CategoryRail`, derived from the space this one tab actually has
   *  (rail height ÷ tab count) rather than a fixed size, so the whole stack always fits the
   *  available height exactly instead of overflowing or leaving a scrollbar. */
  fontSize: number
  iconSize: number
  gap: number
}

const TAB_WIDTH = "w-14 xl:w-16"

/**
 * One entry in the right-docked category rail (desktop only). The rail reserves real layout
 * width next to the map (see `CategoryRail`) rather than floating over it, so the tab is never
 * covering map content the user might want to see or click.
 *
 * Rounded only on the right (the outer edge, away from the map) with the left edge left square
 * where it meets the map — a literal file-tab silhouette attached to the map's edge, rather than
 * a flat rectangle in a boxed-off sidebar column. Active/hovered tabs nudge left, over the seam,
 * to read as poking into the map.
 */
export function CategoryTab({ model, icon: Icon, isActive, onActivate, fontSize, iconSize, gap }: CategoryTabProps) {
  const words = model.title.split(" ")

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={`Mostrar ${model.title}`}
      aria-pressed={isActive}
      className={cn(
        "group relative flex min-h-0 flex-1 shrink-0 items-center justify-center overflow-hidden rounded-r-2xl text-left shadow-[-3px_2px_10px_rgba(0,0,0,0.28)] ring-1 ring-black/10 transition-[transform,box-shadow,opacity] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        TAB_WIDTH,
        isActive
          ? "-translate-x-2 opacity-100 shadow-[-3px_2px_14px_rgba(0,0,0,0.32),0_0_0_2px_var(--primary)]"
          : "opacity-80 hover:-translate-x-1 hover:opacity-100",
      )}
    >
      <Image
        src={model.image || "/placeholder.svg"}
        alt=""
        fill
        sizes="64px"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        className={cn(
          "absolute inset-0 transition-colors duration-300",
          isActive
            ? "bg-primary/70"
            : "bg-white/65 group-hover:bg-white/50 dark:bg-black/60 dark:group-hover:bg-black/45",
        )}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-col items-center px-1" style={{ gap }}>
        <Icon
          className={cn("shrink-0", isActive ? "text-primary-foreground" : "text-black dark:text-white")}
          style={{ width: iconSize, height: iconSize }}
          aria-hidden="true"
        />
        <div className="flex items-start" style={{ gap: Math.max(1, gap / 2) }}>
          {words.map((word) => (
            <span
              key={word}
              style={{ fontSize }}
              className={cn(
                "font-semibold uppercase tracking-wide leading-none [writing-mode:vertical-rl] rotate-180",
                isActive ? "text-primary-foreground" : "text-black dark:text-white",
              )}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
