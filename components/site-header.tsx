import Link from "next/link"
import { Globe2 } from "lucide-react"

const navLinks = [
  { label: "Overview", href: "/" },
  { label: "Models", href: "/#models" },
  { label: "Docs", href: "/#docs" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Globe2 className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Cartograph</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
