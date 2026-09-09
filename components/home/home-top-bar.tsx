"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { openInfoPopup } from "@/lib/open-info-popup"

/**
 * Minimal top bar for the homepage workspace. The full SiteHeader (logo +
 * hazard nav + mobile menu) doesn't fit a single-viewport accordion layout,
 * so this keeps only what still needs a home on "/": the theme toggle and
 * openers for the demografía panel and the documentation page.
 */
export function HomeTopBar() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-end gap-4 border-b border-border px-4 sm:px-6">
      <button
        type="button"
        onClick={() => openInfoPopup("/demografia/popup", "vigia-demografia", { width: 1180, height: 980 })}
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Demografía
      </button>
      <Link
        href="/documentacion"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Documentación
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
      <ThemeToggle />
    </div>
  )
}
