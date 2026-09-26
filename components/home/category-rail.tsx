"use client"

import { useLayoutEffect, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { CategoryTab } from "@/components/home/category-tab"
import type { MapModel } from "@/lib/maps"

interface CategoryRailProps {
  models: MapModel[]
  icons: Record<string, LucideIcon>
  fallbackIcon: LucideIcon
  activeSlug: string
  onActivate: (slug: string) => void
}

/**
 * Right-docked category rail for the desktop hazard workspace. A normal flex
 * column that reserves its own width next to the map row (see
 * `HazardWorkspace`) — the map shrinks to make room for it rather than the
 * rail floating on top of map content. The square inner edge on each tab
 * (see `CategoryTab`) is what makes the rail still read as attached to the
 * map instead of a second sidebar bolted to the window edge.
 *
 * Every tab evenly divides whatever height this rail actually has
 * (measured with `ResizeObserver`, since that height changes with the
 * viewport and isn't knowable from CSS alone) so the stack can never
 * exceed — or need to scroll past — the map's own height. Font size, icon
 * size, and internal spacing are then derived continuously from that
 * per-tab height instead of a fixed breakpoint value, so adding an 9th or
 * 10th category shrinks everything gracefully instead of overflowing or
 * clipping text against the tab edges.
 */
export function CategoryRail({ models, icons, fallbackIcon, activeSlug, onActivate }: CategoryRailProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tabHeight, setTabHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = (height: number) => setTabHeight(height / models.length)
    measure(el.getBoundingClientRect().height)
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height
      if (height) measure(height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [models.length])

  // Continuous scale, not breakpoints: a short viewport or a longer category list simply produces a
  // smaller (but never clipped or scrolled) tab. Clamped so a very tall/short rail doesn't run type
  // past legible or comically large.
  const fontSize = tabHeight ? Math.min(11, Math.max(7, tabHeight / 13)) : 10
  const iconSize = tabHeight ? Math.min(18, Math.max(11, tabHeight / 9)) : 15
  const gap = tabHeight ? Math.min(10, Math.max(3, tabHeight / 16)) : 7

  return (
    <div
      ref={containerRef}
      aria-label="Categorías de mapas"
      className="hidden shrink-0 flex-col py-3 lg:flex lg:w-16 xl:w-20"
    >
      {models.map((model) => (
        <CategoryTab
          key={model.slug}
          model={model}
          icon={icons[model.slug] ?? fallbackIcon}
          isActive={model.slug === activeSlug}
          onActivate={() => onActivate(model.slug)}
          fontSize={fontSize}
          iconSize={iconSize}
          gap={gap}
        />
      ))}
    </div>
  )
}
