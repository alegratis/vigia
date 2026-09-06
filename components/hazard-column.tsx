import Image from "next/image"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import type { MapModel } from "@/lib/maps"

/**
 * Full-bleed photo column used on the homepage hero. Mirrors the original
 * ArcGIS Experience layout (sidebar + one column per hazard, all above the
 * fold) but keeps Vigía's own type, color tokens, and dark/light theming.
 */
export function HazardColumn({ model, icon: Icon }: { model: MapModel; icon: LucideIcon }) {
  return (
    <Link
      href={model.href ?? `/maps/${model.slug}`}
      className="group relative flex min-h-72 flex-1 flex-col justify-end overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:min-h-0"
    >
      <Image
        src={model.image || "/placeholder.svg"}
        alt={model.imageAlt}
        fill
        sizes="(max-width: 1024px) 100vw, 33vw"
        priority
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10 transition-colors duration-300 group-hover:from-black/90"
        aria-hidden="true"
      />

      {model.ready && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-[var(--chart-2)]" aria-hidden="true" />
          En vivo
        </span>
      )}

      <div className="relative flex flex-col gap-2 p-6 sm:p-8">
        <Icon className="size-7 text-white" aria-hidden="true" />
        <h2 className="text-balance text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
          {model.title}
        </h2>
        <p className="max-w-sm text-pretty text-sm leading-relaxed text-white/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {model.hook}
        </p>
      </div>
    </Link>
  )
}
