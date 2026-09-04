export type MapModel = {
  slug: string
  title: string
  description: string
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
    slug: "inundaciones",
    title: "Inundaciones",
    description:
      "Pronóstico de inundaciones fluviales en tiempo casi real con datos GEOGLOWS y umbrales de periodo de retorno para los ríos del Valle del Cauca.",
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
    description:
      "Detección de focos de calor activos con sensores satelitales VIIRS de NASA FIRMS alrededor de Sevilla, Caicedonia y Zarzal.",
    image: "/images/incendios-map.png",
    imageAlt:
      "Mapa de detección de incendios con focos de calor sobre terreno montañoso boscoso",
    tag: "Amenaza térmica",
    href: "/incendios",
    ready: true,
  },
  {
    slug: "deslizamientos",
    title: "Deslizamientos",
    description:
      "Susceptibilidad a movimientos en masa en las laderas de la cordillera. Fuente de datos en definición; módulo próximamente.",
    image: "/images/deslizamientos-map.png",
    imageAlt:
      "Mapa de susceptibilidad a deslizamientos con zonas de riesgo en terreno de pendiente",
    tag: "Amenaza geológica",
    comingSoon: true,
  },
]

export function getMapModel(slug: string): MapModel | undefined {
  return mapModels.find((m) => m.slug === slug)
}
