import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { MapModel } from "@/lib/maps"

export function MapTile({ model }: { model: MapModel }) {
  return (
    <Link
      href={`/maps/${model.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={model.image || "/placeholder.svg"}
          alt={model.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
          {model.tag}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{model.title}</h3>
          <ArrowUpRight
            className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden="true"
          />
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {model.description}
        </p>
      </div>
    </Link>
  )
}
