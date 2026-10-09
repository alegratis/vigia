"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { AlejandroPinoLogo } from "@/components/brand/alejandro-pino-logo"
import { BetaBadge } from "@/components/beta-badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MAX_ACTIVE_LAYERS } from "@/lib/laboratorio/layers"

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const HOW_TO_USE = [
  `Activa capas desde el riel lateral, hasta ${MAX_ACTIVE_LAYERS} a la vez. Clima, Demografía e Hidrantes no se combinan con otras.`,
  "Si dos capas se superponen visualmente verás un aviso, y puedes ajustar la opacidad de cada una.",
  "Filtra por municipio y cambia entre vista 2D y 3D.",
  "Toca una vereda para abrir su reporte en el panel inferior.",
  "Usa “Compartir vista” para copiar un enlace con las capas, el municipio, el zoom y el centro del mapa.",
]

const linkClass =
  "font-medium text-foreground underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * "Acerca de" modal: what Vigía is, how to use it in a few lines, and
 * credits. Opened only from the header button — never automatically.
 */
export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acerca de Vigía</DialogTitle>
          <DialogDescription>
            Plataforma abierta de evaluación de amenazas naturales y vulnerabilidad social.
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <h3 className="text-sm font-semibold text-foreground">Qué es</h3>
          <p>
            Vigía reúne en un solo mapa las amenazas y la vulnerabilidad de Sevilla, Caicedonia, Zarzal y
            Roldanillo. Agrega datos públicos en vivo, sin base de datos propia, para apoyar la prevención. No
            es un pronóstico oficial.
          </p>
        </section>

        <section className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <h3 className="text-sm font-semibold text-foreground">Cómo se usa</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {HOW_TO_USE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          <h3 className="text-sm font-semibold text-foreground">Créditos</h3>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <a
              href="https://www.redlabot.org"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="RED LabOT"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Image
                src="/images/redlabot-mark-light.png"
                alt="RED LabOT"
                width={100}
                height={45}
                className="block h-5 w-auto dark:hidden"
              />
              <Image
                src="/images/redlabot-mark-dark.png"
                alt="RED LabOT"
                width={100}
                height={45}
                className="hidden h-5 w-auto dark:block"
              />
            </a>
            <a
              href="https://nasalifelines.org"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="NASA Lifelines"
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Image
                src="/images/nasa-lifelines-wordmark-darkblue.png"
                alt="NASA Lifelines"
                width={5112}
                height={643}
                className="block h-5 w-auto dark:hidden"
              />
              <Image
                src="/images/nasa-lifelines-wordmark-white.png"
                alt="NASA Lifelines"
                width={5112}
                height={643}
                className="hidden h-5 w-auto dark:block"
              />
            </a>
            <AlejandroPinoLogo className="h-6" />
          </div>
          <p>
            Los índices de susceptibilidad son de{" "}
            <a href="https://www.redlabot.org" target="_blank" rel="noopener noreferrer" className={linkClass}>
              RED LabOT
            </a>
            . Datos de NASA, GEOGLOWS, USGS, SGC, DANE, Copernicus y OpenStreetMap.
          </p>
        </section>

        <DialogFooter className="items-center sm:justify-between">
          <BetaBadge />
          <Link
            href="/documentacion"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Ver documentación completa
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
