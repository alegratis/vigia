import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const GUIDE_CARDS = [
  {
    title: "Panel principal (/)",
    body: "La página de inicio es un flujo de un solo vistazo: un acordeón cambia entre las cuatro amenazas (deslizamientos, inundaciones, incendios, precipitación) sin salir de la pantalla. Cada amenaza trae su propio mapa Leaflet con capas activables, una leyenda y tarjetas de estadísticas de población e infraestructura expuesta.",
  },
  {
    title: "Vistas completas por amenaza",
    body: "Los enlaces del menú superior (Deslizamientos, Inundaciones, Incendios, Precipitación) abren la versión de página completa de cada mapa, con el mismo contenido que el panel de inicio pero con más espacio en pantalla — útil para monitoreo prolongado o pantallas grandes.",
  },
  {
    title: "Demografía",
    body: "Accesible desde \"Demografía\" en el menú (o el botón del panel de inicio): abre una ventana emergente sin barra de navegador con la población proyectada del DANE por municipio, cruzada con el peor nivel de amenaza registrado en cada uno.",
  },
  {
    title: "Conoce tu nivel de exposición",
    body: "Desde la ventana emergente de exposición: primero elige un municipio y luego una vereda o su \"Casco Urbano\" (el núcleo urbano de cada cabecera municipal). El mapa se ajusta a esa zona y permite activar cada amenaza junto a su pronóstico en vivo. El botón \"Exportar como PDF\" captura el mapa y un resumen de texto en un PDF descargable.",
  },
  {
    title: "Tema claro / oscuro",
    body: "El interruptor de tema (ícono de sol/luna) en la esquina superior derecha alterna entre claro, oscuro y el tema del sistema operativo. La preferencia se recuerda entre visitas.",
  },
  {
    title: "Accesibilidad",
    body: "Todas las páginas incluyen un enlace \"Saltar al contenido principal\" para navegación por teclado, roles y etiquetas ARIA en controles interactivos, y regiones aria-live en los paneles que se actualizan con datos en vivo.",
  },
]

export function SectionUso() {
  return (
    <section id="uso" className="flex flex-col gap-4 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">Guía de uso</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Cómo moverse por cada vista de la aplicación.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GUIDE_CARDS.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle className="text-base">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
