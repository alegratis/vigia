"use client"

import { useEffect, useState } from "react"
import { Map as MapIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isValidBounds, type MapBounds } from "@/lib/map-bounds"

interface QgisMapCanvasProps {
  /** Hazard slug; the map is served from public/maps/<slug>/index.html. */
  slug: string
  title: string
  onBoundsChange?: (bounds: MapBounds) => void
  className?: string
}

/**
 * Embeds a static Leaflet export produced by the QGIS "qgis2web" plugin.
 * The export is placed at public/maps/<slug>/ and served as a same-origin
 * iframe, so its embedded map object can broadcast viewport changes back to
 * this page via postMessage (see QgisExportGuide for the bridge snippet).
 */
export function QgisMapCanvas({ slug, title, onBoundsChange, className }: QgisMapCanvasProps) {
  const src = `/maps/${slug}/index.html`
  const [status, setStatus] = useState<"checking" | "available" | "missing">("checking")

  useEffect(() => {
    let cancelled = false
    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "available" : "missing")
      })
      .catch(() => {
        if (!cancelled) setStatus("missing")
      })
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    if (!onBoundsChange) return
    const handleBoundsChange = onBoundsChange
    function handleMessage(event: MessageEvent) {
      const data = event.data as { type?: string; bounds?: unknown } | undefined
      if (!data || data.type !== "vigia:map-bounds") return
      if (isValidBounds(data.bounds)) handleBoundsChange(data.bounds)
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [onBoundsChange])

  if (status === "missing") {
    return (
      <Card className={className}>
        <CardContent className="flex h-[320px] flex-col items-center justify-center gap-3 text-center sm:h-[480px]">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MapIcon className="size-6" aria-hidden="true" />
          </span>
          <p className="font-medium">Mapa aún no publicado</p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Exporta la capa desde QGIS con el plugin qgis2web y coloca el resultado en{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">public/maps/{slug}/</code>.
            Consulta la guía de publicación debajo.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`overflow-hidden ${className ?? ""}`}>
      {status === "checking" ? (
        <Skeleton className="h-[320px] w-full rounded-none sm:h-[480px]" />
      ) : (
        <iframe
          key={slug}
          src={src}
          title={title}
          className="h-[320px] w-full border-0 sm:h-[480px]"
          loading="lazy"
        />
      )}
    </Card>
  )
}
