"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, Check, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ZonePicker, type VeredaOption } from "@/components/alertas/zone-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HAZARD_HINTS,
  HAZARD_LABELS,
  SENSITIVITY_OPTIONS,
  postAlertas,
  toRequestZones,
  type ZoneChoice,
} from "@/lib/alertas/client"
import { CONSENT_TEXT, OFFICIAL_DISCLAIMER } from "@/lib/alertas/consent"
import { MUNICIPIOS } from "@/lib/alertas/municipios"
import { ALERT_HAZARDS, type AlertHazard, type Sensitivity } from "@/lib/alertas/types"
import { useVeredas } from "@/lib/veredas/use-veredas"

type Step = "config" | "phone" | "code" | "done"

const COUNTRY_OPTIONS = [
  { dial: "57", label: "Colombia" },
  { dial: "1", label: "EE. UU. / Canadá" },
  { dial: "52", label: "México" },
  { dial: "58", label: "Venezuela" },
  { dial: "593", label: "Ecuador" },
  { dial: "34", label: "España" },
]

interface SubscribeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Vereda preseleccionada, por ejemplo desde el reporte de una vereda. */
  initialVereda?: { code: string; name: string; municipio: string } | null
}

interface StartResponse {
  ok: boolean
  error?: string
  phoneMasked?: string
}

interface VerifyResponse {
  ok: boolean
  error?: string
  manageToken?: string
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function SubscribeDialog({ open, onOpenChange, initialVereda }: SubscribeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto sm:max-w-lg">
        <SubscribeFlow initialVereda={initialVereda ?? null} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function initialZones(initial: SubscribeDialogProps["initialVereda"]): ZoneChoice[] {
  if (!initial) return []
  const municipio = MUNICIPIOS.find((m) => m.name === initial.municipio)
  if (!municipio) return []
  return [
    { municipioCode: municipio.code, municipioName: municipio.name, veredaCode: initial.code, veredaName: initial.name },
  ]
}

function SubscribeFlow({
  initialVereda,
  onClose,
}: {
  initialVereda: SubscribeDialogProps["initialVereda"]
  onClose: () => void
}) {
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

  const [step, setStep] = useState<Step>("config")
  const [zones, setZones] = useState<ZoneChoice[]>(() => initialZones(initialVereda))
  const [hazards, setHazards] = useState<AlertHazard[]>([...ALERT_HAZARDS])
  const [sensitivity, setSensitivity] = useState<Sensitivity>("preventivas_y_emergencias")
  const [phone, setPhone] = useState("")
  const [consent, setConsent] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null)
  const [manageToken, setManageToken] = useState<string | null>(null)

  const [dialCode, setDialCode] = useState("57")
  const typedPlus = phone.trim().startsWith("+")
  const phoneDigits = phone.replace(/\D/g, "")
  const nationalDigits =
    dialCode !== "57" && phoneDigits.startsWith(dialCode) && phoneDigits.length > dialCode.length + 7
      ? phoneDigits.slice(dialCode.length)
      : phoneDigits
  const fullPhone = typedPlus ? phone.trim() : dialCode === "57" ? phone : `+${dialCode}${nationalDigits}`

  const basePayload = { phone: fullPhone, zones: toRequestZones(zones), hazards, sensitivity, consent }

  const toggleHazard = (h: AlertHazard) =>
    setHazards((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]))

  const sendCode = async () => {
    setBusy(true)
    setError(null)
    const res = await postAlertas<StartResponse>("/api/alertas/suscribir", basePayload)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? "No se pudo enviar el código.")
    setPhoneMasked(res.phoneMasked ?? null)
    setCode("")
    setStep("code")
  }

  const verify = async () => {
    setBusy(true)
    setError(null)
    const res = await postAlertas<VerifyResponse>("/api/alertas/verificar", { ...basePayload, code })
    setBusy(false)
    if (!res.ok || !res.manageToken) return setError(res.error ?? "No se pudo validar el código.")
    setManageToken(res.manageToken)
    setStep("done")
  }

  const manageUrl = manageToken ? `${window.location.origin}/alertas/gestionar#${manageToken}` : null

  const copyManageUrl = () => {
    if (!manageUrl) return
    navigator.clipboard
      .writeText(manageUrl)
      .then(() => toast("Enlace copiado"))
      .catch(() => toast.error("No se pudo copiar el enlace"))
  }

  const configValid = zones.length > 0 && hazards.length > 0
  const phoneValid = (typedPlus ? phoneDigits.length >= 8 : nationalDigits.length >= 10) && consent

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Bell className="size-4" aria-hidden="true" />
          {step === "done" ? "Alertas activadas" : "Recibir alertas por SMS"}
        </DialogTitle>
        <DialogDescription>
          {step === "config" && "Un SMS solo cuando hay una probabilidad alta de que algo ocurra en su zona."}
          {step === "phone" && "Verificaremos su número con un código para que nadie inscriba el de otra persona."}
          {step === "code" && `Escribimos un código de 6 dígitos al ${phoneMasked ?? "número indicado"}.`}
          {step === "done" && "Le enviamos un SMS de confirmación."}
        </DialogDescription>
      </DialogHeader>

      {step === "config" && (
        <div className="flex flex-col gap-5">
          <ZonePicker zones={zones} onChange={setZones} veredas={veredaOptions} />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Qué amenazas vigilar</legend>
            <div className="flex flex-col gap-1.5">
              {ALERT_HAZARDS.map((h) => (
                <label
                  key={h}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    checked={hazards.includes(h)}
                    onChange={() => toggleHazard(h)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{HAZARD_LABELS[h]}</span>
                    <span className="text-xs text-muted-foreground">{HAZARD_HINTS[h]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Cuántos avisos</legend>
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
          </fieldset>

          <Button onClick={() => setStep("phone")} disabled={!configValid}>
            Continuar
          </Button>
        </div>
      )}

      {step === "phone" && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (phoneValid && !busy) void sendCode()
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="alert-phone" className="text-sm font-medium text-foreground">
              Número de celular
            </label>
            <div className="flex items-center gap-2">
              {!typedPlus && (
                <select
                  aria-label="Código de país"
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                  className="h-10 shrink-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.dial} value={c.dial}>
                      +{c.dial} {c.label}
                    </option>
                  ))}
                </select>
              )}
              <input
                id="alert-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder={dialCode === "57" ? "300 123 4567" : "416 555 0123"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>
            {!typedPlus && dialCode !== "57" && (
              <p className="text-xs text-muted-foreground">
                Fuera de Colombia solo se aceptan números autorizados para pruebas.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              {CONSENT_TEXT}{" "}
              <Link href="/privacidad" target="_blank" className="font-medium text-foreground underline underline-offset-4">
                Aviso de privacidad
              </Link>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("config")} disabled={busy}>
              <ArrowLeft className="size-4" />
              Atrás
            </Button>
            <Button type="submit" className="flex-1" disabled={!phoneValid || busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Enviar código
            </Button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length >= 4 && !busy) void verify()
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="alert-code" className="text-sm font-medium text-foreground">
              Código de verificación
            </label>
            <input
              id="alert-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
              autoFocus
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("phone")} disabled={busy}>
              <ArrowLeft className="size-4" />
              Atrás
            </Button>
            <Button type="button" variant="secondary" onClick={() => void sendCode()} disabled={busy}>
              Reenviar
            </Button>
            <Button type="submit" className="flex-1" disabled={code.length < 4 || busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Activar alertas
            </Button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md bg-accent p-3 text-sm text-accent-foreground">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Recibirá un SMS cuando haya una probabilidad alta de {hazards.map((h) => HAZARD_LABELS[h].toLowerCase()).join(", ")} en{" "}
              {zones.length === 1 ? "la zona elegida" : `las ${zones.length} zonas elegidas`}. Para darse de baja responda SALIR.
            </p>
          </div>
          {manageUrl && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Guarde este enlace para cambiar zonas, pausar los avisos o darse de baja:
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs text-foreground">{manageUrl}</code>
                <Button size="icon" variant="secondary" onClick={copyManageUrl} aria-label="Copiar enlace de gestión">
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{OFFICIAL_DISCLAIMER}</p>
          <Button onClick={onClose}>Listo</Button>
        </div>
      )}
    </>
  )
}
