"use client"

import Link from "next/link"
import { TriangleAlert } from "lucide-react"
import useSWR from "swr"
import { HAZARD_LABELS } from "@/lib/alertas/client"
import type { AlertHazard } from "@/lib/alertas/types"

interface ActiveAlert {
  id: string
  hazard: AlertHazard
  tier: "prepararse" | "actuar"
  zone: string
  createdAt: string
}

interface ActiveAlertsResponse {
  ok: boolean
  alerts: ActiveAlert[]
}

const fetcher = async (url: string): Promise<ActiveAlertsResponse> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("No se pudo cargar las alertas")
  return res.json()
}

const RECENT_HOURS = 24

/** Muestra lo mismo que reciben los suscriptores. No se dibuja si no hay alertas recientes. */
export function ActiveAlertsChip() {
  const { data } = useSWR("/api/alertas/activas", fetcher, { refreshInterval: 120_000, revalidateOnFocus: false })

  const cutoff = Date.now() - RECENT_HOURS * 3_600_000
  const recent = (data?.alerts ?? []).filter((a) => Date.parse(a.createdAt) >= cutoff)
  if (recent.length === 0) return null

  const urgent = recent.filter((a) => a.tier === "actuar")
  const lead = urgent[0] ?? recent[0]
  const extra = recent.length - 1

  return (
    <Link
      href="/alertas"
      className="absolute top-3 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/90 px-3.5 py-2 text-sm text-card-foreground shadow-lg backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <TriangleAlert
        className={`size-4 shrink-0 ${lead.tier === "actuar" ? "text-destructive" : "text-primary"}`}
        aria-hidden="true"
      />
      <span className="truncate">
        <span className="font-medium">
          {lead.tier === "actuar" ? "Actuar" : "Prepararse"}: {HAZARD_LABELS[lead.hazard].toLowerCase()}
        </span>{" "}
        <span className="text-muted-foreground">en {lead.zone}</span>
      </span>
      {extra > 0 && <span className="shrink-0 text-xs text-muted-foreground">+{extra} más</span>}
    </Link>
  )
}
