import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CONSENT_VERSION, OFFICIAL_DISCLAIMER } from "@/lib/alertas/consent"

export const metadata: Metadata = {
  title: "Aviso de privacidad | Vigía",
  description: "Cómo trata Vigía el número de celular de quienes se suscriben a las alertas por SMS.",
}

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Qué datos recogemos",
    body: [
      "Su número de celular, las zonas (municipio o vereda) y amenazas que eligió, su preferencia de cantidad de avisos y la fecha y versión del consentimiento que aceptó.",
      "También guardamos el historial de los SMS enviados y su estado de entrega, para evitar mensajes repetidos y atender reclamos.",
      "No pedimos nombre, correo ni ubicación en tiempo real.",
    ],
  },
  {
    title: "Para qué los usamos",
    body: [
      "Únicamente para enviarle alertas por SMS sobre riesgos en las zonas que eligió y para verificar que el número es suyo. No usamos su número para publicidad ni lo vendemos o compartimos con terceros.",
    ],
  },
  {
    title: "Con quién se comparte",
    body: [
      "El envío de SMS y el código de verificación se procesan a través de Twilio, y los datos se almacenan en Supabase. Ambos actúan como encargados del tratamiento y solo reciben lo necesario para prestar el servicio.",
    ],
  },
  {
    title: "Sus derechos",
    body: [
      "Conforme a la Ley 1581 de 2012 puede conocer, actualizar, rectificar y suprimir sus datos, y revocar la autorización en cualquier momento.",
      "Para darse de baja responda SALIR a cualquier mensaje. Con el enlace de gestión que recibe al suscribirse puede cambiar zonas, pausar los avisos, darse de baja o eliminar todos sus datos.",
    ],
  },
  {
    title: "Conservación",
    body: [
      "Si se da de baja conservamos solo el número, marcado como dado de baja, para no volver a escribirle. Si elige eliminar sus datos, se borran por completo junto con su historial de envíos.",
    ],
  },
  {
    title: "Alcance del servicio",
    body: [OFFICIAL_DISCLAIMER, "Los avisos son orientativos, pueden fallar o retrasarse y no reemplazan a las autoridades."],
  },
]

export default function PrivacidadPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al mapa
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground">Aviso de privacidad</h1>
          <p className="text-sm text-muted-foreground">Alertas por SMS · versión {CONSENT_VERSION}</p>
        </div>
      </header>

      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="text-pretty leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
