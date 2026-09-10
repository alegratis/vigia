"use client"

import { useRef, useState } from "react"
import { CloudRain, Download, Droplets, Flame, Loader2, MapPin, Mountain, type LucideIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { resolveCssColor } from "@/lib/resolve-css-color"
import { COMPOUND_LEVEL_STYLES } from "@/lib/riesgo-compuesto/levels"
import type { CompoundFeature } from "@/lib/riesgo-compuesto/api-types"

const HAZARD_ICONS: Record<string, LucideIcon> = {
  deslizamientos: Mountain,
  inundaciones: Droplets,
  incendios: Flame,
  precipitacion: CloudRain,
}

/** Strips accents/diacritics and non-alphanumerics for a safe PDF filename, e.g. "Río Totoro" -> "rio-totoro". */
function slugifyFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/**
 * Full expandable compound-risk report for one vereda — same dialog
 * interaction pattern as `StationDetailDialog` (open/close driven by
 * whether `feature` is set). Data-first, methodology-last: narrative,
 * per-hazard breakdown, and demographics all come before the "how this is
 * calculated" explanation, matching the ordering convention already
 * established by the inundaciones model panel.
 */
export function CompoundReportDialog({
  feature,
  onOpenChange,
}: {
  feature: CompoundFeature | null
  onOpenChange: (open: boolean) => void
}) {
  const props = feature?.properties
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  async function handleExportPdf() {
    if (!captureRef.current || !props) return
    setExporting(true)
    setExportError(null)
    try {
      // html2canvas-pro (not the original html2canvas) is required here since it can parse
      // the modern oklch()/lab() color functions our Tailwind v4 design tokens resolve to —
      // the original throws instead of rendering. Same approach as ExposicionMapImpl's export.
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ])
      const canvas = await html2canvas(captureRef.current, {
        useCORS: true,
        backgroundColor: "#ffffff",
        scale: 2,
      })
      const imgData = canvas.toDataURL("image/png")

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 32

      pdf.setFontSize(16)
      pdf.text("Reporte de riesgo compuesto", margin, margin)
      pdf.setFontSize(11)
      pdf.text(`${props.nombre}, ${props.municipio}`, margin, margin + 20)
      pdf.text(`Generado: ${new Date().toLocaleString("es-CO")}`, margin, margin + 36)

      const imgTop = margin + 52
      const maxWidth = pageWidth - margin * 2
      const maxHeight = pageHeight - imgTop - margin
      const scaleRatio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
      const imgWidth = canvas.width * scaleRatio
      const imgHeight = canvas.height * scaleRatio

      pdf.addImage(imgData, "PNG", margin, imgTop, imgWidth, imgHeight)
      pdf.save(`riesgo-compuesto-${slugifyFilename(props.municipio)}-${slugifyFilename(props.nombre)}.pdf`)
    } catch (err) {
      console.error("[v0] Export a PDF falló:", err)
      setExportError("No se pudo generar el PDF. Intenta de nuevo.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={feature != null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {props && (
          <>
            <DialogHeader className="shrink-0 gap-2 border-b border-border px-6 py-5 text-left">
              <div className="flex items-start justify-between gap-3">
                <DialogDescription className="inline-flex items-center gap-1.5 text-sm">
                  <MapPin className="size-4" aria-hidden="true" />
                  {props.municipio}
                </DialogDescription>
                <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exporting} className="shrink-0">
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <Download data-icon="inline-start" aria-hidden="true" />
                  )}
                  Exportar PDF
                </Button>
              </div>
              <DialogTitle className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                {props.nombre}
              </DialogTitle>
              {props.compoundLevel && props.actionTier ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className="text-white"
                    style={{ backgroundColor: resolveCssColor(COMPOUND_LEVEL_STYLES[props.compoundLevel].colorToken) }}
                  >
                    Riesgo compuesto: {props.compoundLevel}
                  </Badge>
                  <Badge variant="outline">{props.actionTier}</Badge>
                  {props.compoundScore != null && (
                    <span className="text-xs text-muted-foreground">Puntaje: {props.compoundScore.toFixed(2)}</span>
                  )}
                </div>
              ) : (
                <Badge variant="outline">Sin datos suficientes</Badge>
              )}
              {exportError && <p className="text-xs text-destructive">{exportError}</p>}
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div ref={captureRef} className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <p className="text-pretty text-sm leading-relaxed text-foreground">{props.narrative.resumen}</p>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {props.narrative.demografia}
                  </p>
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Desglose por amenaza
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {props.subHazards.map((h) => {
                      const Icon = HAZARD_ICONS[h.hazard] ?? Mountain
                      return (
                        <div key={h.hazard} className="flex flex-col gap-1 rounded-md border border-border p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="size-4 shrink-0" style={{ color: resolveCssColor(h.colorToken) }} aria-hidden="true" />
                            <span className="text-sm font-medium text-foreground">{h.label}</span>
                          </div>
                          <span className="text-sm text-foreground">{h.rawLevel ?? "Sin datos"}</span>
                          {h.detail && <span className="text-xs text-muted-foreground">{h.detail}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Metodología
                  </p>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    El nivel de riesgo compuesto es el mayor nivel entre las cuatro amenazas (deslizamientos,
                    inundaciones, incendios y precipitación), cada una normalizada a una escala de 0 a 1 —
                    la doctrina de la OMM/GDACS de que &quot;la amenaza más alta gobierna&quot;: un solo
                    riesgo severo nunca se diluye con otros tres tranquilos. El puntaje (0–1) es, en cambio,
                    un promedio ponderado de las cuatro (25% cada una, re-normalizado sobre las que sí
                    tengan datos para esta vereda) — al estilo del Índice de Riesgo INFORM — y sirve para
                    comparar veredas dentro del mismo nivel, no para definir el nivel en sí. El nivel
                    compuesto se traduce además al marco de Informar/Prepararse/Actuar que ya usa IDEAM en
                    sus propios boletines públicos. No incluye el pronóstico de caudal en vivo de GEOGLOWS —
                    ese pronóstico es por tramo de río, no por vereda, y el modelo propio de inundación
                    (zonificación + cercanía a cauce + planicie del terreno) ya representa esa amenaza aquí,
                    igual que en las otras tres categorías.{" "}
                    <a href="/documentacion#metodologia" className="text-primary underline-offset-2 hover:underline">
                      Ver metodología completa
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
