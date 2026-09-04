import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { MapModel } from "@/lib/maps"

export function MapTile({ model }: { model: MapModel }) {
  const content = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={model.image || "/placeholder.svg"}
          alt={model.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className={
            model.comingSoon
              ? "object-cover opacity-60 grayscale"
              : "object-cover transition-transform duration-300 group-hover:scale-105"
          }
        />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
          {model.tag}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">{model.title}</h3>
            {model.ready && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <span
                  className="size-1.5 rounded-full bg-[var(--chart-2)]"
                  aria-hidden="true"
                />
                En vivo
              </span>
            )}
            {model.comingSoon && (
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Próximamente
              </span>
            )}
          </div>
          {!model.comingSoon && (
            <ArrowUpRight
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
              aria-hidden="true"
            />
          )}
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {model.description}
        </p>
      </div>
    </>
  )

  if (model.comingSoon) {
    return (
      <div
        aria-disabled="true"
        className="flex cursor-default flex-col overflow-hidden rounded-xl border border-border bg-card"
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      href={model.href ?? `/maps/${model.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {content}
    </Link>
  )
}
