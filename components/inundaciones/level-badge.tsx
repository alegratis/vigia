import { cn } from "@/lib/utils"
import { levelStyle } from "@/lib/flood-ui"
import type { FloodLevelKey } from "@/lib/geoglows/flood"

export function LevelBadge({
  level,
  label,
  className,
  size = "sm",
}: {
  level: FloodLevelKey
  /** Optional override label; defaults to the level's Spanish label. */
  label?: string
  className?: string
  size?: "sm" | "lg"
}) {
  const style = levelStyle(level)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-secondary font-medium text-secondary-foreground",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        className,
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: style.color }}
        aria-hidden="true"
      />
      {label ?? style.label}
    </span>
  )
}
