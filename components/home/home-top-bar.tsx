"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { BETA_VERSION } from "@/lib/version"

/**
 * Minimal top bar for the homepage workspace. The full SiteHeader (logo +
 * hazard nav + mobile menu) doesn't fit a single-viewport accordion layout,
 * so this keeps only what still needs a home on "/": the theme toggle and
 * an opener for the documentation page. Demografía now lives entirely
 * inside its own workspace panel (below its map), so it no longer needs a
 * separate popup entry point here.
 */
export function HomeTopBar() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-end gap-4 border-b border-border px-4 sm:px-6">
      <span
        className="hidden select-none text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50 sm:inline"
        title="Vigía está en fase beta"
      >
        Beta v0.{BETA_VERSION}
      </span>
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
