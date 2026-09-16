import { ExposicionPanel } from "@/components/exposicion/exposicion-panel"
import { SelectedPlaceProvider } from "@/lib/lugares/use-selected-place"

export const metadata = {
  title: "Conoce tu nivel de exposición | Vigía",
  description:
    "Selecciona tu municipio y vereda para ver un mapa enfocado con las amenazas monitoreadas por Vigía y su pronóstico, listo para imprimir o exportar como PDF.",
  robots: { index: false, follow: false },
}

/**
 * Chrome-free popup opened via lib/open-info-popup.ts from the sidebar CTA
 * (see components/home/hazard-workspace.tsx). No SiteHeader/SiteFooter
 * here on purpose — the popup window itself has no browser UI either, so
 * this page is only ever the picker + focused map.
 *
 * The popup opens in a separate window with no shared React state, so the
 * municipio the user had selected on the homepage arrives via `?mun=` and
 * seeds its own SelectedPlaceProvider. From there the picker can switch to
 * any municipio in the country.
 */
export default async function ExposicionPopupPage({
  searchParams,
}: {
  searchParams: Promise<{ mun?: string }>
}) {
  const { mun } = await searchParams

  return (
    <SelectedPlaceProvider initialCode={mun ?? null}>
      <div className="flex min-h-screen flex-col">
        <main id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-none">
          <ExposicionPanel />
        </main>
      </div>
    </SelectedPlaceProvider>
  )
}
