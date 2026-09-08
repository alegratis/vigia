const LAYERS = [
  {
    title: "Framework y renderizado",
    body: "Next.js 16 (App Router) con React 19 y TypeScript. Las páginas son Server Components por defecto; los mapas y controles interactivos se marcan \"use client\" solo donde necesitan estado o efectos del navegador.",
  },
  {
    title: "Acceso a datos, sin base de datos propia",
    body: "Cada fuente externa tiene un módulo server-only en lib/<amenaza>/client.ts que llama directamente a su API/WMS/WMTS pública. No hay capa de persistencia: la app es una capa de agregación en vivo sobre servicios públicos ya existentes.",
  },
  {
    title: "Rutas de API y hooks de datos",
    body: "Cada módulo servidor se expone mediante una ruta en app/api/**/route.ts, que envuelve el resultado en un sobre JSON consistente ({ data } o { error }) con manejo de errores. Los componentes cliente consumen esas rutas con hooks de SWR (lib/**/use-*.ts) para caché y revalidación en el navegador.",
  },
  {
    title: "Estrategia de caché",
    body: "El caché de fetch de Next (next: { revalidate }) se ajusta por fuente según qué tan rápido cambia: FIRMS cada 15 min, capas de ArcGIS cada hora, límites administrativos cada semana, y las proyecciones del DANE no hacen ninguna llamada de red — se leen de un JSON estático versionado en el repositorio.",
  },
  {
    title: "Mapas",
    body: "Leaflet y react-leaflet, importados dinámicamente con next/dynamic({ ssr: false }) para evitar que el renderizado en servidor choque con las dependencias de window/document de Leaflet. Cada amenaza combina GeoJSON, CircleMarker, TileLayer, WMSTileLayer e ImageOverlay según la forma de su fuente.",
  },
  {
    title: "Estilos y sistema de diseño",
    body: "Tailwind CSS v4 con tokens de diseño definidos en app/globals.css (escalas de color en oklch por amenaza/categoría), componentes de shadcn/ui sobre primitivas de Base UI, y next-themes para el tema claro/oscuro/sistema.",
  },
  {
    title: "Ventanas emergentes sin barra de navegador",
    body: "lib/open-info-popup.ts abre vistas de referencia auxiliares (Demografía, Conoce tu nivel de exposición) en una ventana emergente sin menú, barra de herramientas ni barra de direcciones — para no interrumpir el mapa en vivo que el usuario tenía abierto. La documentación, en cambio, abre en una pestaña normal del navegador porque es contenido extenso pensado para desplazarse, imprimirse o guardarse como marcador.",
  },
  {
    title: "Exportación a PDF",
    body: "El botón \"Exportar como PDF\" del selector de exposición usa html2canvas-pro para capturar el mapa como imagen (se eligió sobre el html2canvas original, sin mantenimiento, porque este último no soporta las funciones de color CSS modernas —lab()/oklch()— que usan los tokens de Tailwind v4) y jsPDF para componer el documento final.",
  },
  {
    title: "Despliegue",
    body: "Vercel. Vercel Analytics solo se activa en producción (process.env.NODE_ENV === 'production').",
  },
]

export function SectionArquitectura() {
  return (
    <section id="arquitectura" className="flex flex-col gap-4 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">Arquitectura</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Cómo está construida la plataforma, de la interfaz al dato.
      </p>
      <div className="flex flex-col gap-4">
        {LAYERS.map((layer) => (
          <div key={layer.title} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
            <h3 className="text-sm font-semibold text-foreground">{layer.title}</h3>
            <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{layer.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
