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
}

/**
 * One entry in the right-docked category rail (desktop only). This is the
 * markup `CategoryPanel`'s collapsed branch used to render inline in the
 * map row — same photo, icon, and title — now living in a fixed-position
 * vertical stack that never moves as categories are activated, so the map
 * next to it always claims the same amount of space regardless of which
 * (or how many) categories exist.
 *
 * The rounded-left / flush-right corners plus the slight negative right
 * margin on the active tab give it a literal file-folder-tab silhouette:
 * it reads as sticking out from the rail's edge rather than just being a
 * highlighted rectangle in a list.
 */
export function CategoryTab({ model, icon: Icon, isActive, onActivate }: CategoryTabProps) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={`Mostrar ${model.title}`}
      aria-pressed={isActive}
      className={cn(
        "group relative flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-l-xl text-left transition-[margin,box-shadow,opacity] duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:h-24 xl:w-16",
        isActive ? "-mr-2 opacity-100 shadow-[0_0_0_2px_var(--primary)]" : "opacity-85 hover:opacity-100",
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
      <div className="relative z-10 flex flex-col items-center gap-1.5 px-1">
        <Icon
          className={cn("size-4 shrink-0", isActive ? "text-primary-foreground" : "text-black dark:text-white")}
          aria-hidden="true"
        />
        <span
          className={cn(
            "line-clamp-1 text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180",
            isActive ? "text-primary-foreground" : "text-black dark:text-white",
          )}
        >
          {model.title}
        </span>
      </div>
    </button>
  )
}
