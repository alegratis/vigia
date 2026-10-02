"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Menu, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { BETA_VERSION } from "@/lib/version"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { MapModel } from "@/lib/maps"

interface MobileHeaderProps {
  models: MapModel[]
  icons: Record<string, LucideIcon>
  fallbackIcon: LucideIcon
  activeSlug: string
  onActivate: (slug: string) => void
}

/**
 * Compact mobile-only header (`lg:hidden`, the desktop `HomeTopBar` covers
 * that breakpoint instead): just the two brand marks plus a hamburger
 * button. Replaces the old approach of relying on the horizontal photo
 * strips for category switching on narrow screens — those ate real
 * vertical space above the fold and pushed the map down several screens.
 * The hamburger opens a full category list in a Sheet instead, so the map
 * can claim the first fold immediately below this bar.
 */
export function MobileHeader({ models, icons, fallbackIcon, activeSlug, onActivate }: MobileHeaderProps) {
  const [open, setOpen] = useState(false)

  function handleActivate(slug: string) {
    onActivate(slug)
    setOpen(false)
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:hidden">
      <div className="flex items-center gap-3">
        <span className="relative flex h-6 items-center justify-center">
          <Image
            src="/images/redlabot-mark-light.png"
            alt="RED LabOT"
            width={100}
            height={45}
            className="block h-5 w-auto dark:hidden"
            priority
          />
          <Image
            src="/images/redlabot-mark-dark.png"
            alt="RED LabOT"
            width={100}
            height={45}
            className="hidden h-5 w-auto dark:block"
            priority
          />
        </span>
        <span aria-hidden="true" className="h-6 w-px bg-border" />
        <span className="relative flex size-7 items-center justify-center">
          <Image
            src="/images/vigia-mark-light.png"
            alt="Vigía"
            width={84}
            height={65}
            className="block dark:hidden"
            priority
          />
          <Image
            src="/images/vigia-mark-dark.png"
            alt="Vigía"
            width={84}
            height={65}
            className="hidden dark:block"
            priority
          />
        </span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Abrir menú de categorías"
          className="flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Menu className="size-4" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="right" className="flex w-80 flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle className="text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Categorías
            </SheetTitle>
          </SheetHeader>

          <nav aria-label="Categorías de mapas" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {models.map((model) => {
              const Icon = icons[model.slug] ?? fallbackIcon
              const isActive = model.slug === activeSlug
              return (
                <button
                  key={model.slug}
                  type="button"
                  onClick={() => handleActivate(model.slug)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{model.title}</span>
                  {model.ready && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        isActive ? "bg-primary-foreground/20" : "bg-muted text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isActive ? "bg-primary-foreground" : "bg-[var(--chart-2)]",
                        )}
                        aria-hidden="true"
                      />
                      En vivo
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <Link
              href="/documentacion"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Documentación
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
            <div className="flex items-center gap-3">
              <span
                className="select-none text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50"
                title="Vigía está en fase beta"
              >
                Beta v0.{BETA_VERSION}
              </span>
              <ThemeToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
