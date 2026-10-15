"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { SubscribeDialog } from "@/components/alertas/subscribe-dialog"
import { Button } from "@/components/ui/button"

/** Acceso al alta de alertas por SMS desde el encabezado del Laboratorio. */
export function AlertBellButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="hidden sm:inline-flex">
        <Bell className="size-3.5" />
        Recibir alertas
      </Button>
      <Button
        size="icon"
        variant="secondary"
        onClick={() => setOpen(true)}
        className="sm:hidden"
        aria-label="Recibir alertas por SMS"
      >
        <Bell className="size-3.5" />
      </Button>
      <SubscribeDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
