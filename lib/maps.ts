export type MapModel = {
  slug: string
  title: string
  description: string
  image: string
  imageAlt: string
  tag: string
}

export const mapModels: MapModel[] = [
  {
    slug: "amenazas",
    title: "Amenazas",
    description:
      "Modelos de peligrosidad por inundación, deslizamiento y otros fenómenos, con niveles de intensidad y periodos de retorno.",
    image: "/images/amenazas-map.png",
    imageAlt: "Mapa de amenazas con zonas de peligrosidad graduadas sobre el terreno",
    tag: "Peligrosidad",
  },
  {
    slug: "vulnerabilidad",
    title: "Vulnerabilidad",
    description:
      "Índices de vulnerabilidad social, física y económica por unidad territorial, con exposición de población e infraestructura.",
    image: "/images/vulnerabilidad-map.png",
    imageAlt: "Mapa coroplético de vulnerabilidad por distritos urbanos",
    tag: "Exposición",
  },
  {
    slug: "riesgo",
    title: "Riesgo",
    description:
      "Evaluación compuesta de riesgo que combina amenaza y vulnerabilidad, con puntos críticos y escenarios de gestión.",
    image: "/images/riesgo-map.png",
    imageAlt: "Mapa compuesto de riesgo con puntos críticos resaltados sobre la ciudad",
    tag: "Riesgo compuesto",
  },
]

export function getMapModel(slug: string): MapModel | undefined {
  return mapModels.find((m) => m.slug === slug)
}
