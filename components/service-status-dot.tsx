"use client"

import useSWR from "swr"
import { cn } from "@/lib/utils"

type Estado = "ok" | "degradado" | "desconocido"

const COPY: Record<Estado, { label: string; dot: string }> = {
  ok: { label: "Todos los servicios operan con normalidad", dot: "status-glow text-status-ok" },
  degradado: { label: "Algunos servicios funcionan con limitaciones", dot: "status-glow text-status-warn" },
  desconocido: { label: "Estado de los servicios no disponible", dot: "text-muted-foreground/50" },
}

async function fetchStatus(url: string): Promise<{ estado: Estado }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Estado no disponible")
  return res.json()
}

/** Punto discreto con brillo suave: verde si todo está en orden, ámbar si algo funciona con limitaciones. */
export function ServiceStatusDot({ className }: { className?: string }) {
  const { data } = useSWR("/api/salud/estado", fetchStatus, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  })
  const copy = COPY[data?.estado ?? "desconocido"]

  return (
    <span role="status" title={copy.label} className={cn("flex size-6 shrink-0 items-center justify-center", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-full bg-current", copy.dot)} />
      <span className="sr-only">{copy.label}</span>
    </span>
  )
}
