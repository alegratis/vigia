/**
 * Renders a WMS server's own GetLegendGraphic image on a fixed white chip.
 * These legend images are drawn by the remote server (GWIS/EFFIS, in every
 * current use) and aren't theme-aware, so a fixed white background — rather
 * than the app's card token — keeps them legible in dark mode too.
 */
export function WmsLegendChip({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div className="pointer-events-none rounded-md border border-border bg-white p-1.5 shadow-sm">
      <img src={src || "/placeholder.svg"} alt={alt} className={className ?? "block"} />
    </div>
  )
}
