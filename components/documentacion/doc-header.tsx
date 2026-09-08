import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

/**
 * Minimal header for the standalone /documentacion page. This route opens
 * in a normal new browser tab (not lib/open-info-popup.ts's chromeless
 * popup) since documentation is long-form, scrollable content the reader
 * may want to print, bookmark, or zoom — so it keeps full browser UI and
 * gets its own lightweight header instead of the app's SiteHeader, whose
 * hazard-category nav links don't apply here.
 */
export function DocHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="relative flex size-9 items-center justify-center">
            <Image
              src="/images/vigia-mark-light.png"
              alt=""
              width={64}
              height={49}
              className="block dark:hidden"
              priority
            />
            <Image
              src="/images/vigia-mark-dark.png"
              alt=""
              width={64}
              height={49}
              className="hidden dark:block"
              priority
            />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Vigía</span>
            <span className="text-xs text-muted-foreground">Documentación</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Volver a Vigía</span>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
