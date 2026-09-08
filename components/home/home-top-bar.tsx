import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Minimal top bar for the homepage workspace. The full SiteHeader (logo +
 * hazard nav + mobile menu) doesn't fit a single-viewport accordion layout,
 * so this keeps only what still needs a home on "/": the theme toggle and a
 * link out to /demografia.
 */
export function HomeTopBar() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-end gap-4 border-b border-border px-4 sm:px-6">
      <Link
        href="/demografia"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Demografía
      </Link>
      <ThemeToggle />
    </div>
  )
}
