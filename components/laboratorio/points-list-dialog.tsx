"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { LabPointFeature } from "@/lib/laboratorio/use-lab-points"

interface PointsListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  points: LabPointFeature[]
  visibleCount: number
  onSelect: (point: LabPointFeature) => void
}

/**
 * Lists every point in a points layer (sismología, hidrantes), not just
 * the trimmed subset drawn on the map — the map only renders the first
 * `MAX_VISIBLE_POINTS` so a dense layer never swamps the canvas, this
 * modal is how the rest stay reachable. Clicking a row flies the map to
 * it and opens its popup, same as clicking its marker directly would.
 */
export function PointsListDialog({ open, onOpenChange, title, points, visibleCount, onSelect }: PointsListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Mostrando {Math.min(visibleCount, points.length)} de {points.length} en el mapa. Selecciona cualquiera para ir a su ubicación.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-1">
          {points.map((point, index) => (
            <Button
              key={point.id}
              type="button"
              variant="ghost"
              onClick={() => {
                onSelect(point)
                onOpenChange(false)
              }}
              className="h-auto w-full justify-start gap-3 px-2 py-2 text-left"
            >
              <span
                className="mt-0.5 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--${point.colorToken})` }}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {point.label}
                  {index < visibleCount && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      en mapa
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{point.sublabel}</span>
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
