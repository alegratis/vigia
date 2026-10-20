"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
import { ZonePicker, type VeredaOption } from "@/components/alertas/zone-picker"
import { Button } from "@/components/ui/button"
import {
  HAZARD_HINTS,
  HAZARD_LABELS,
  SENSITIVITY_OPTIONS,
  toRequestZones,
  type ZoneChoice,
} from "@/lib/alertas/client"
import { ALERT_HAZARDS, type AlertHazard, type Sensitivity } from "@/lib/alertas/types"
import { useVeredas } from "@/lib/veredas/use-veredas"

interface ManageResponse {
  ok: boolean
  error?: string
  phoneMasked: string
  sensitivity: Sensitivity
  pausedUntil: string | null
  unsubscribed: boolean
  hazards: AlertHazard[]
  zones: ZoneChoice[]
}

class ManageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const fetcher = async ([url, token]: [string, string]): Promise<ManageResponse> => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = (await res.json().catch(() => null)) as ManageResponse | null
  if (!res.ok || !body) throw new ManageError(body?.error ?? "No se pudo cargar su suscripción.", res.status)
  return body
}

async function callManage(token: string, method: "PATCH" | "DELETE", body?: unknown, query = "") {
  const res = await fetch(`/api/alertas/gestionar${query}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null
  return json ?? { ok: false, error: "Sin conexión. Intente de nuevo." }
}

export function ManageSubscription() {
  const [token, setToken] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    setToken(window.location.hash.replace(/^#/, "") || null)
  }, [])

  if (token === undefined) return <Loading />
  if (token === null) return <Notice text="Este enlace está incompleto. Use el enlace que recibió por SMS o al suscribirse." />
  return <ManageForm token={token} />
}

function Loading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" />
      Cargando…
    </div>
  )
}

function Notice({ text }: { text: string }) {
  return <p className="rounded-md border border-border p-4 text-sm leading-relaxed text-muted-foreground">{text}</p>
}

function ManageForm({ token }: { token: string }) {
  const { data, error, mutate } = useSWR<ManageResponse, ManageError>(["/api/alertas/gestionar", token], fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  if (error) {
    return (
      <Notice
        text={
          error.status === 401
            ? "Este enlace de gestión no es válido o ya fue reemplazado. Si se suscribió de nuevo, use el enlace más reciente."
            : error.message
        }
      />
    )
  }
  if (!data) return <Loading />
  return <ManageContent key={data.zones.length + data.sensitivity} token={token} data={data} onChanged={() => void mutate()} />
}

function ManageContent({ token, data, onChanged }: { token: string; data: ManageResponse; onChanged: () => void }) {
  const { veredas } = useVeredas(true)
  const veredaOptions = useMemo<VeredaOption[]>(
    () =>
      (veredas?.features ?? []).map((f) => ({
        code: f.properties.codigoVereda,
        name: f.properties.nombre,
        municipio: f.properties.municipio,
        urbano: Boolean(f.properties.esCascoUrbano),
      })),
    [veredas],
  )

  const [zones, setZones] = useState<ZoneChoice[]>(data.zones)
  const [hazards, setHazards] = useState<AlertHazard[]>(data.hazards.length > 0 ? data.hazards : [...ALERT_HAZARDS])
  const [sensitivity, setSensitivity] = useState<Sensitivity>(data.sensitivity)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmErase, setConfirmErase] = useState(false)

  const paused = data.pausedUntil !== null && Date.parse(data.pausedUntil) > Date.now()

  const run = async (label: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(label)
    const res = await action()
    setBusy(null)
    if (!res.ok) return toast.error(res.error ?? "No se pudo completar la acción.")
    toast.success(success)
    onChanged()
  }

  const toggleHazard = (h: AlertHazard) =>
    setHazards((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]))

  const save = () =>
    run(
      "save",
      () => callManage(token, "PATCH", { zones: toRequestZones(zones), hazards, sensitivity }),
      "Cambios guardados",
    )

  const pause = (days: number) =>
    run("pause", () => callManage(token, "PATCH", { pauseDays: days }), days === 0 ? "Alertas reanudadas" : `Alertas en pausa por ${days} días`)

  if (data.unsubscribed) {
    return (
      <div className="flex flex-col gap-4">
        <Notice text={`El número ${data.phoneMasked} está dado de baja y no recibirá más mensajes. Para volver a recibir alertas, suscríbase de nuevo desde el mapa.`} />
        <Button
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void run("erase", () => callManage(token, "DELETE", undefined, "?erase=1"), "Datos eliminados")}
        >
          Eliminar mis datos por completo
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Número registrado</p>
        <p className="font-mono text-lg text-foreground">{data.phoneMasked}</p>
        {paused && data.pausedUntil && (
          <p className="text-sm text-primary">
            En pausa hasta {new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(new Date(data.pausedUntil))}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Zonas</h2>
        <ZonePicker zones={zones} onChange={setZones} veredas={veredaOptions} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Amenazas</h2>
        <div className="flex flex-col gap-1.5">
          {ALERT_HAZARDS.map((h) => (
            <label
              key={h}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="checkbox" checked={hazards.includes(h)} onChange={() => toggleHazard(h)} className="mt-1 size-4 accent-primary" />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{HAZARD_LABELS[h]}</span>
                <span className="text-xs text-muted-foreground">{HAZARD_HINTS[h]}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Cuántos avisos</h2>
        <div className="flex flex-col gap-1.5">
          {SENSITIVITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="sensibilidad"
                checked={sensitivity === o.value}
                onChange={() => setSensitivity(o.value)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{o.label}</span>
                <span className="text-xs text-muted-foreground">{o.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <Button onClick={() => void save()} disabled={busy !== null || zones.length === 0 || hazards.length === 0}>
        {busy === "save" && <Loader2 className="size-4 animate-spin" />}
        Guardar cambios
      </Button>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-foreground">Pausar o salir</h2>
        <div className="flex flex-wrap gap-2">
          {paused ? (
            <Button variant="secondary" disabled={busy !== null} onClick={() => void pause(0)}>
              Reanudar alertas
            </Button>
          ) : (
            <>
              <Button variant="secondary" disabled={busy !== null} onClick={() => void pause(7)}>
                Pausar 7 días
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={() => void pause(30)}>
                Pausar 30 días
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void run("unsub", () => callManage(token, "DELETE"), "Se dio de baja")}
          >
            Darme de baja
          </Button>
        </div>

        {confirmErase ? (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3">
            <p className="text-sm text-foreground">Se borrarán su número, zonas e historial de envíos. No se puede deshacer.</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={busy !== null}
                onClick={() => void run("erase", () => callManage(token, "DELETE", undefined, "?erase=1"), "Datos eliminados")}
              >
                Sí, eliminar todo
              </Button>
              <Button variant="ghost" onClick={() => setConfirmErase(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmErase(true)}
            className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Eliminar mis datos por completo
          </button>
        )}
      </section>
    </div>
  )
}
