"use client"

import { useLayoutEffect, useRef, useState, type LucideIcon } from "react"
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
 * Right-docked category rail for the desktop hazard workspace. Floats
 * absolutely over the active map's right edge (see `HazardWorkspace`)
 * rather than reserving its own flex column, so the map keeps its full
 * width and the tabs read as tabs *on* the map instead of a second sidebar
 * bolted to the window edge.
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
      className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden flex-col py-3 pr-0 lg:flex lg:w-16 xl:w-20"
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
