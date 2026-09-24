import { cn } from "@/lib/utils"

/**
 * Personal brand mark for Alejandro Pino — technical direction, software
 * development, and GIS systems at RED LabOT.
 *
 * The glyph reads as a geodetic benchmark / total-station reticle: an
 * accuracy ring broken by one open reading, four survey ticks, and a fixed
 * coordinate point at the center — a nod to the GIS/spatial-data work this
 * app itself is built on. It's built entirely from strokes and a single
 * 48x48 viewBox with no raster assets, so it scales cleanly from a small
 * footer credit up to a large standalone lockup and survives any future
 * re-theme since it inherits `currentColor` instead of baking in a fixed
 * palette.
 */
export function AlejandroPinoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("text-foreground", className)}
    >
      <circle
        cx="24"
        cy="24"
        r="19"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="104 16"
        transform="rotate(-90 24 24)"
      />
      <circle cx="24" cy="5" r="2.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="24" y1="10" x2="24" y2="14" />
        <line x1="24" y1="34" x2="24" y2="38" />
        <line x1="10" y1="24" x2="14" y2="24" />
        <line x1="34" y1="24" x2="38" y2="24" />
      </g>
      <circle cx="24" cy="24" r="3.5" fill="currentColor" />
    </svg>
  )
}

/**
 * Full lockup — mark plus wordmark — for use anywhere the brand needs to
 * stand on its own (e.g. next to a partner logo in a footer credit row).
 */
export function AlejandroPinoLogo({
  className,
  markClassName,
}: {
  className?: string
  markClassName?: string
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <AlejandroPinoMark className={cn("h-8 w-8 shrink-0", markClassName)} />
      <div className="flex flex-col items-start leading-none">
        <span className="text-sm font-semibold tracking-wide">ALEJANDRO PINO</span>
        <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground whitespace-nowrap">
          {"SIG - DESARROLLO"}
        </span>
      </div>
    </div>
  )
}
