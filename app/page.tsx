import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { MapTile } from "@/components/map-tile"
import { mapModels } from "@/lib/maps"

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        <section id="modelos" className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Modelos de riesgo
            </h1>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Seleccione un modelo para abrir su interfaz interactiva. Cada modelo se
              alimenta del backend QGIS mediante los servicios de ArcGIS y expone sus
              propias herramientas de análisis y gestión.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {mapModels.map((model) => (
              <MapTile key={model.slug} model={model} />
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
