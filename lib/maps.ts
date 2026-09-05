export type MapModel = {
  slug: string
  title: string
  description: string
  /** Short anticipatory hook shown prominently on the tile. */
  hook: string
  image: string
  imageAlt: string
  tag: string
  /** Optional destination override; defaults to /maps/<slug>. */
  href?: string
  /** Whether the model's interface is live (vs. a placeholder). */
  ready?: boolean
  /** Whether the model has no destination yet and should render as a preview. */
  comingSoon?: boolean
}

export const mapModels: MapModel[] = [
  {
    slug: "deslizamientos",
    title: "Deslizamientos",
    hook: "Anticipamos dónde es más probable que ocurra un deslizamiento antes de que se convierta en una emergencia.",
    description:
      "Integramos modelos satelitales de la NASA, información ambiental del territorio y precipitación en tiempo real para identificar las zonas con mayor probabilidad de ocurrencia. El modelo de susceptibilidad está en definición; ya puedes explorar el mapa base y la demografía del área.",
    image: "/images/deslizamientos-map.png",
    imageAlt:
      "Mapa de susceptibilidad a deslizamientos con zonas de riesgo en terreno de pendiente",
    tag: "Amenaza geológica",
    href: "/deslizamientos",
  },
  {
    slug: "inundaciones",
    title: "Inundaciones",
    hook: "Anticipamos cuándo y dónde una inundación podría afectar a las comunidades antes de que ocurra la emergencia.",
    description:
      "Analizamos diariamente los pronósticos hidrológicos de GEOGLOWS: 52 modelos de conjunto para estimar la evolución de los caudales durante los próximos días e identificar excedencias asociadas a eventos extremos con umbrales de periodo de retorno.",
    image: "/images/inundaciones-map.png",
    imageAlt:
      "Mapa de inundación con manchas de agua a lo largo de un río sobre el terreno",
    tag: "Amenaza hídrica",
    href: "/inundaciones",
    ready: true,
  },
  {
    slug: "incendios",
    title: "Incendios",
    hook: "Detectamos señales tempranas de incendios para actuar antes de que el fuego se propague.",
    description:
      "Monitoreamos de forma continua los focos de calor detectados por los sensores satelitales VIIRS de NASA FIRMS alrededor de Sevilla, Caicedonia y Zarzal, generando alertas que fortalecen la prevención y la respuesta en el territorio.",
    image: "/images/incendios-map.png",
    imageAlt:
      "Mapa de detección de incendios con focos de calor sobre terreno montañoso boscoso",
    tag: "Amenaza térmica",
    href: "/incendios",
    ready: true,
  },
]

export function getMapModel(slug: string): MapModel | undefined {
  return mapModels.find((m) => m.slug === slug)
}
