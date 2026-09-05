import { ChevronDown } from "lucide-react"

const BRIDGE_SNIPPET = `<script>
  (function () {
    function broadcast() {
      if (typeof map === "undefined") return
      var b = map.getBounds()
      window.parent.postMessage({
        type: "vigia:map-bounds",
        bounds: {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        },
      }, "*")
    }
    if (typeof map !== "undefined") {
      map.whenReady(broadcast)
      map.on("moveend zoomend", broadcast)
    }
  })()
</script>`

export function QgisExportGuide({ slug }: { slug: string }) {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        Cómo publicar este mapa desde QGIS
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4 text-sm leading-relaxed text-muted-foreground">
        <ol className="list-decimal space-y-3 pl-4">
          <li>
            En QGIS, con las capas del área de estudio cargadas, abre{" "}
            <span className="font-medium text-foreground">
              Complementos → qgis2web → Create web map
            </span>{" "}
            y elige <span className="font-medium text-foreground">Leaflet</span> como
            motor de exportación.
          </li>
          <li>
            Exporta a una carpeta local y copia{" "}
            <span className="font-medium text-foreground">todo su contenido</span>{" "}
            (incluido <code className="rounded bg-muted px-1 py-0.5 text-xs">index.html</code>
            ) dentro de este proyecto, en:
            <br />
            <code className="mt-1 inline-block rounded bg-muted px-2 py-1 text-xs text-foreground">
              public/maps/{slug}/
            </code>
          </li>
          <li>
            Para que la población en pantalla se actualice según el encuadre visible,
            abre el <code className="rounded bg-muted px-1 py-0.5 text-xs">index.html</code>{" "}
            exportado y pega este bloque justo antes de{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">&lt;/body&gt;</code>:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">
              <code>{BRIDGE_SNIPPET}</code>
            </pre>
            qgis2web declara el mapa de Leaflet en una variable global llamada{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">map</code> (definida en{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">main.js</code>); si tu
            exportación usa otro nombre, ajústalo en el bloque anterior.
          </li>
          <li>
            Guarda los archivos: en desarrollo se sirven directamente desde{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">public/</code>, sin
            reiniciar el servidor. En producción, vuelve a desplegar el sitio para que
            los nuevos archivos queden publicados.
          </li>
        </ol>
      </div>
    </details>
  )
}
