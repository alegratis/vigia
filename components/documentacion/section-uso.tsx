import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface GuideStep {
  number: number
  title: string
  simple: string
  technical?: string
  image: {
    src: string
    alt: string
    width: number
    height: number
  }
}

const STEPS: GuideStep[] = [
  {
    number: 1,
    title: "Elige una amenaza para vigilar",
    simple:
      "Cuando abres Vigía, ya estás viendo un mapa. A la derecha hay cinco franjas verticales con un ícono cada una: Deslizamientos, Inundaciones, Incendios, Precipitación y Sismología (más Riesgo compuesto, que junta las cinco). Toca cualquier franja y el mapa completo cambia a esa amenaza — no se abre una página nueva, todo pasa en la misma pantalla.",
    technical:
      "Cada amenaza carga su propio mapa Leaflet con capas independientes que se activan y desactivan con las casillas de la esquina superior izquierda (por ejemplo, \"Humedad del suelo (SMAP)\" o \"Fallas geológicas (SGC)\"). La leyenda de colores está siempre en la esquina inferior — de verde (muy bajo) a rojo (muy alto).",
    image: {
      src: "/images/docs/panel-principal.png",
      alt: "Panel principal de Vigía mostrando el mapa de deslizamientos, la leyenda de colores y las franjas de las otras amenazas a la derecha",
      width: 1364,
      height: 1149,
    },
  },
  {
    number: 2,
    title: "Descubre cuánta gente vive en riesgo",
    simple:
      "Arriba a la derecha hay un enlace llamado \"Demografía\". Ábrelo y verás cuántas personas viven en Sevilla, Caicedonia y Zarzal, separadas por año, si viven en el pueblo o en el campo, y si son hombres o mujeres. También te dice qué tan grave es cada amenaza en cada municipio en este momento.",
    technical:
      "Los números vienen de las proyecciones poblacionales del DANE (2019–2026) y se cruzan en el momento con la señal de monitoreo en vivo de cada amenaza, para saber quién está más expuesto y dónde. Esta vista se abre en una ventana propia sin barra de navegador, para no interrumpir lo que tenías abierto en el mapa principal.",
    image: {
      src: "/images/docs/demografia.png",
      alt: "Ventana de demografía mostrando población urbana y rural, un gráfico por municipio y tarjetas de Sevilla, Caicedonia y Zarzal",
      width: 1180,
      height: 980,
    },
  },
  {
    number: 3,
    title: "Revisa tu propio nivel de riesgo",
    simple:
      "El botón celeste \"Conoce tu nivel de exposición\", en la esquina superior izquierda del panel principal, es la forma más rápida de saber qué tan expuesto estás tú. Elige primero tu municipio y después tu vereda (o \"Casco Urbano\" si vives en el pueblo). El mapa se acerca a tu zona y muestra las cuatro amenazas juntas, ya activadas.",
    technical:
      "Cada casilla de la leyenda (Deslizamientos, Inundaciones, Incendios, Precipitación) se puede apagar por separado para comparar una amenaza a la vez sobre la misma zona. El botón \"Exportar como PDF\" — visible en la esquina superior derecha de esta ventana — captura el mapa exactamente como lo estás viendo y genera un PDF descargable para guardar o imprimir.",
    image: {
      src: "/images/docs/exposicion.png",
      alt: "Ventana de exposición con Sevilla y Casco Urbano seleccionados, el mapa de las cuatro amenazas y el botón Exportar como PDF",
      width: 1180,
      height: 980,
    },
  },
  {
    number: 4,
    title: "Abre el reporte completo de una vereda",
    simple:
      "Dentro del mapa de \"Riesgo compuesto\", toca cualquier vereda coloreada. Se abre una ventana con el nombre del lugar, el nivel de riesgo (Bajo, Medio, Alto...), qué hacer al respecto (Informar, Prepararse o Actuar) y el detalle de cada una de las cinco amenazas por separado. También tiene su propio botón para exportar ese reporte a PDF.",
    technical:
      "El nivel de riesgo compuesto es el mayor entre las cinco amenazas normalizadas (la amenaza más alta gobierna, siguiendo la doctrina de la OMM/GDACS), mientras que el puntaje de 0 a 1 es un promedio ponderado al estilo del Índice de Riesgo INFORM. El texto del reporte es una plantilla que se rellena con los mismos números que ya se ven en el mapa — no usa generación de lenguaje ni la puerta de enlace de IA de la app.",
    image: {
      src: "/images/docs/riesgo-compuesto-reporte.png",
      alt: "Reporte de riesgo compuesto para una vereda de Zarzal, con el nivel de riesgo, el desglose por amenaza y el botón Exportar PDF",
      width: 1364,
      height: 1149,
    },
  },
]

const OTHER_TIPS = [
  {
    title: "Vistas completas por amenaza",
    body: "Los enlaces del menú superior (Deslizamientos, Inundaciones, Incendios, Precipitación) abren la versión de página completa de cada mapa, con el mismo contenido que el panel de inicio pero con más espacio en pantalla — útil para monitoreo prolongado o pantallas grandes.",
  },
  {
    title: "Tema claro y oscuro",
    body: "El ícono de sol/luna, en la esquina superior derecha de cualquier página, alterna entre tema claro, oscuro y el tema del computador. Vigía recuerda cuál elegiste la próxima vez que abras la página.",
  },
  {
    title: "Uso con teclado y lectores de pantalla",
    body: "Todas las páginas incluyen un enlace \"Saltar al contenido principal\" al presionar Tab por primera vez, roles y etiquetas ARIA en los controles interactivos, y regiones aria-live en los paneles que se actualizan con datos en vivo — para que un lector de pantalla anuncie los cambios sin que el usuario tenga que buscarlos.",
  },
]

export function SectionUso() {
  return (
    <section id="uso" className="flex flex-col gap-6 scroll-mt-24">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Guía de uso</h2>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Cuatro pasos para pasar de abrir Vigía a entender el riesgo de tu vereda, con una captura de
          pantalla real de cada uno. Cada paso trae además una nota técnica más corta, por si quieres
          saber exactamente de dónde sale cada número.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {STEPS.map((step) => (
          <Card key={step.number} className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-pretty leading-relaxed text-foreground">{step.simple}</p>
              <Image
                src={step.image.src || "/placeholder.svg"}
                alt={step.image.alt}
                width={step.image.width}
                height={step.image.height}
                className="w-full rounded-lg border border-border"
              />
              {step.technical && (
                <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
                  <Badge variant="outline" className="w-fit text-xs">
                    Nota técnica
                  </Badge>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{step.technical}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <h3 className="text-lg font-semibold tracking-tight">Otros detalles útiles</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {OTHER_TIPS.map((tip) => (
            <Card key={tip.title}>
              <CardHeader>
                <CardTitle className="text-base">{tip.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
