"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MAX_ACTIVE_LAYERS } from "@/lib/laboratorio/layers"

interface LayerLimitDialogProps {
  open: boolean
  activeCount: number
  onDismiss: () => void
}

/**
 * Shown when the user tries to activate more than `MAX_ACTIVE_LAYERS` at
 * once. Never blocks activation retroactively — the workspace simply
 * refuses the toggle that would exceed the limit and opens this instead,
 * so there's nothing to "undo" here.
 */
export function LayerLimitDialog({ open, activeCount, onDismiss }: LayerLimitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ya tienes {activeCount} capas activas</AlertDialogTitle>
          <AlertDialogDescription>
            Para mantener el mapa legible, hasta {MAX_ACTIVE_LAYERS} capas pueden estar activas a la vez. Prueba
            con Deslizamientos + Incendios, o con Inundaciones sola, antes de agregar otra.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onDismiss}>Entendido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
