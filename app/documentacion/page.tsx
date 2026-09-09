import { DocHeader } from "@/components/documentacion/doc-header"
import { DocToc } from "@/components/documentacion/doc-toc"
import { DocFooter } from "@/components/documentacion/doc-footer"
import { SectionResumen } from "@/components/documentacion/section-resumen"
import { SectionUso } from "@/components/documentacion/section-uso"
import { SectionFuncionalidades } from "@/components/documentacion/section-funcionalidades"
import { SectionFuentes } from "@/components/documentacion/section-fuentes"
import { SectionMetodologia } from "@/components/documentacion/section-metodologia"
import { SectionArquitectura } from "@/components/documentacion/section-arquitectura"
import { SectionLicencias } from "@/components/documentacion/section-licencias"

export const metadata = {
  title: "Documentación | Vigía",
  description:
    "Guía de uso, funcionalidades, fuentes de datos, arquitectura y licencias de código abierto de Vigía, la plataforma de evaluación de riesgos de Sevilla, Caicedonia y Zarzal.",
}

/**
 * Standalone documentation route, deliberately not wired into the main
 * app's SiteHeader/SiteFooter — it's meant to open in a plain new browser
 * tab (see components/site-header.tsx's "Documentación" link) rather than
 * live inside the hazard-workspace chrome, so it keeps full browser UI for
 * a long, scrollable, printable reference document.
 */
export default function DocumentacionPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <DocHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-10 sm:px-6 sm:py-12">
          <h1 className="text-balance text-3xl font-semibold tracking-tight">Documentación</h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Guía de uso, funcionalidades, fuentes de datos, arquitectura y licencias de código
            abierto de Vigía.
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[200px_1fr]">
          <DocToc />
          <div className="flex flex-col gap-14">
            <SectionResumen />
            <SectionUso />
            <SectionFuncionalidades />
            <SectionFuentes />
            <SectionMetodologia />
            <SectionArquitectura />
            <SectionLicencias />
          </div>
        </div>
      </main>
      <DocFooter />
    </div>
  )
}
