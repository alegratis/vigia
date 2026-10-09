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
    title: "Elige y combina las capas que quieres vigilar",
    simple:
      "Cuando abres Vigía, ya estás viendo el mapa con la capa de Riesgo compuesto activa. En el riel lateral están todas las capas: Deslizamientos, Inundaciones, Incendios, Precipitación, Sismología, Riesgo compuesto y, aparte, Clima, Demografía e Hidrantes. Toca una para encenderla o apagarla; puedes tener hasta tres activas a la vez para compararlas en el mismo mapa. Clima es un reporte del tiempo, no una amenaza.",
    technical:
      "Todo ocurre en un único lienzo MapLibre GL. Cada capa se define en lib/laboratorio/layers.ts con sus controles propios (por ejemplo, \"Humedad del suelo (SMAP)\" o \"Fallas geológicas (SGC)\"). Cuando dos capas activas se superponen visualmente aparece un aviso y se puede ajustar la opacidad de cada una. Clima, Demografía e Hidrantes no se combinan con otras capas porque comparten el mapa de una forma incompatible con los modelos de amenaza.",
    image: {
      src: "/images/docs/lab-capas.png",
      alt: "Vigía con el selector de capas en la parte superior, la capa de Riesgo compuesto activa sobre Sevilla y el panel derecho con la leyenda de niveles",
      width: 1440,
      height: 900,
    },
  },
  {
    number: 2,
    title: "Ajusta la vista y compártela",
    simple:
      "En la barra superior puedes filtrar por municipio (Sevilla, Caicedonia, Zarzal o Roldanillo) y cambiar entre la vista plana (2D) y la vista con relieve (3D). Cuando tengas el mapa como lo quieres, toca \"Compartir vista\": se copia un enlace que abre Vigía exactamente con las mismas capas, el mismo municipio y la misma zona del mapa.",
    technical:
      "El estado de la vista (capas, municipio, 2D/3D, zoom y centro) se refleja en la URL con los parámetros layers, municipio, is3D, zoom y center, y también se guarda en localStorage para recordarlo en la próxima visita. Un enlace compartido tiene prioridad sobre lo guardado.",
    image: {
      src: "/images/docs/lab-vista.png",
      alt: "Vigía en vista 3D con tres capas activas y la barra superior con el filtro de municipio y el botón Compartir vista",
      width: 1440,
      height: 900,
    },
  },
  {
    number: 3,
    title: "Descubre cuánta gente vive en riesgo y dónde está el hidrante más cercano",
    simple:
      "Activa \"Demografía\" para ver cuántas personas viven en Sevilla, Caicedonia, Zarzal y Roldanillo, separadas por año, por pueblo o campo y por sexo, junto con el Índice de Vulnerabilidad Social (IVS) por manzana en el casco urbano. Activa \"Hidrantes\" y, con tu ubicación o tocando un punto del casco urbano de Sevilla, el mapa resalta el hidrante más cercano con la distancia y la ruta más corta por calles; las instituciones educativas, de salud y de gobierno cercanas aparecen como polígonos con la forma real de cada edificio.",
    technical:
      "Los números de población vienen de las proyecciones del DANE (2019–2026). El IVS combina 4 dimensiones del censo (vivienda, servicios públicos, educación y trabajo) con el nivel de amenaza vigente de cada zona; en el casco urbano se calcula por manzana y en el campo se usa el promedio municipal, como una capa plana y opcional para no fingir una precisión que el dato no tiene. La ruta al hidrante se calcula con OSRM sobre la red vial real y las instituciones se dibujan siempre como polígonos para no confundirlas con los hidrantes ni con el radio de cobertura de 100/150 m.",
    image: {
      src: "/images/docs/lab-demografia.png",
      alt: "Vigía con la capa de Demografía activa mostrando columnas 3D del Índice de Vulnerabilidad Social por manzana en Sevilla y sus indicadores en el panel derecho",
      width: 1440,
      height: 900,
    },
  },
  {
    number: 4,
    title: "Consulta una vereda y conoce la plataforma",
    simple:
      "Toca cualquier vereda del mapa para ver una ficha con su nombre, el municipio, la población estimada y la infraestructura crítica cercana. Con la capa de \"Riesgo compuesto\" activa, el color de cada vereda indica la amenaza más severa entre deslizamientos, inundaciones e incendios. Si en algún momento quieres un resumen de qué es Vigía y cómo se usa, el botón \"i\" de la barra superior abre la ventana \"Acerca de\", con los créditos y la versión beta.",
    technical:
      "El nivel de riesgo compuesto es el mayor entre las amenazas normalizadas (la amenaza más alta gobierna, siguiendo la doctrina de la OMM/GDACS), mientras que el puntaje de 0 a 1 es un promedio ponderado al estilo del Índice de Riesgo INFORM. La ficha de cada vereda se arma con los mismos datos que ya se ven en el mapa; no usa generación de lenguaje ni la puerta de enlace de IA de la app.",
    image: {
      src: "/images/docs/lab-acerca.png",
      alt: "Ventana \"Acerca de Vigía\" sobre el mapa, con la explicación de qué es la plataforma, cómo se usa, los créditos y el indicador de versión beta",
      width: 1440,
      height: 900,
    },
  },
]

const OTHER_TIPS = [
  {
    title: "Tema claro y oscuro",
    body: "El ícono de sol/luna, en la esquina superior derecha, alterna entre tema claro, oscuro y el tema del computador. Vigía recuerda cuál elegiste la próxima vez que abras la página.",
  },
  {
    title: "Acerca de Vigía",
    body: "El botón con la letra \"i\", junto al tema, abre una ventana con una explicación breve de la plataforma, los créditos y la versión beta en curso. Desde ahí también puedes abrir esta documentación.",
  },
  {
    title: "Uso con teclado y lectores de pantalla",
    body: "Los controles interactivos tienen roles y etiquetas ARIA, se pueden recorrer con el teclado y las ventanas se cierran con Esc. Las regiones que se actualizan con datos en vivo usan aria-live para que un lector de pantalla anuncie los cambios sin que el usuario tenga que buscarlos.",
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
