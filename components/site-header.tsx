import Link from "next/link"
import Image from "next/image"
import { ThemeToggle } from "@/components/theme-toggle"

const navLinks = [
  { label: "Panel", href: "/" },
  { label: "Deslizamientos", href: "/deslizamientos" },
  { label: "Inundaciones", href: "/inundaciones" },
  { label: "Incendios", href: "/incendios" },
  { label: "Demografía", href: "/demografia" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
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
          <span className="text-lg font-semibold tracking-tight">Vigía</span>
        </Link>

        <div className="flex items-center gap-1">
          <nav aria-label="Navegación principal" className="flex items-center gap-1">
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
          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
