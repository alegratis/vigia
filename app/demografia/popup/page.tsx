import { DemografiaOverview } from "@/components/demografia/demografia-overview"

export const metadata = {
  title: "Demografía y exposición | Vigía",
  description:
    "Población de referencia por municipio en el Valle del Cauca, cruzada con las amenazas de inundación, incendio y deslizamiento monitoreadas por Vigía.",
  robots: { index: false, follow: false },
}

/**
 * Chrome-free counterpart of /demografia, opened via lib/open-info-popup.ts
 * in a small floating window instead of navigating the main app to it. No
 * SiteHeader/SiteFooter here on purpose — the popup window itself has no
 * browser UI either, so this page is only ever the informative content.
 */
export default function DemografiaPopupPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-4 py-6 sm:px-6">
        <h1 className="text-balance text-xl font-semibold tracking-tight">
          Conoce tu nivel de exposición
        </h1>
        <p className="mt-1 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Población de Sevilla, Caicedonia y Zarzal según el DANE, cruzada con
          la señal de monitoreo en vivo de cada amenaza para estimar quién
          está más expuesto y dónde.
        </p>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 focus-visible:outline-none sm:px-6">
        <div aria-live="polite">
          <DemografiaOverview />
        </div>
      </main>
    </div>
  )
}
