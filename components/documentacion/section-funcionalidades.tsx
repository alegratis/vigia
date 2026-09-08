import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const FEATURES = [
  {
    title: "Deslizamientos",
    tags: ["Sevilla", "Caicedonia"],
    items: [
      "Índice de susceptibilidad a deslizamientos (RED LabOT) por punto, con población, escuelas, hospitales, farmacias e infraestructura crítica expuestas por nivel de amenaza.",
      "Superposición de pronóstico de humedad del suelo de raíz (NASA SMAP L4), actualizada cada 3–4 días.",
      "\"Sitios críticos\": puntos de daño vial relevados en campo por la Secretaría de Infraestructura del Valle del Cauca.",
    ],
  },
  {
    title: "Inundaciones",
    tags: ["Sevilla", "Caicedonia"],
    items: [
      "Polígonos de susceptibilidad estática a inundación por vereda.",
      "Pronóstico de caudal en vivo de GEOGLOWS, evaluado contra períodos de retorno calculados localmente (ajuste de Gumbel) sobre el registro retrospectivo del tramo de río más cercano.",
      "Superposición de tasa de precipitación en vivo (NASA GPM IMERG, actualizada cada ~30 minutos).",
    ],
  },
  {
    title: "Incendios",
    tags: ["Sevilla", "Caicedonia"],
    items: [
      "Polígonos de amenaza por incendio forestal, por vereda.",
      "Índice de riesgo de incendio (FWI) en vivo de Copernicus GWIS/EFFIS, con selector de día de pronóstico.",
      "Detecciones activas de incendio (satélites VIIRS) de NASA FIRMS, con radio de búsqueda configurable.",
    ],
  },
  {
    title: "Demografía",
    tags: ["Sevilla", "Caicedonia", "Zarzal"],
    items: [
      "Población proyectada del DANE (2018–2042) por municipio, con desagregación urbano/rural y hombres/mujeres.",
      "Cruce con el peor nivel de amenaza por deslizamiento registrado en cada municipio.",
    ],
  },
  {
    title: "Conoce tu nivel de exposición",
    tags: ["Por vereda", "Casco Urbano"],
    items: [
      "Selector de municipio → vereda (o \"Casco Urbano\", el núcleo urbano de la cabecera municipal).",
      "Mapa enfocado en la zona elegida con las tres amenazas y sus pronósticos disponibles como capas independientes.",
      "Exportación a PDF del mapa capturado junto con un resumen de las amenazas activas.",
    ],
  },
  {
    title: "Infraestructura",
    tags: ["OpenStreetMap"],
    items: [
      "Puntos de interés (salud, financiero, gobierno, social, comercial) clasificados desde OpenStreetMap y mostrados junto a cada panel de amenaza.",
    ],
  },
]

export function SectionFuncionalidades() {
  return (
    <section id="funcionalidades" className="flex flex-col gap-4 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight">Funcionalidades</h2>
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Qué hace cada módulo de la plataforma.
      </p>
      <div className="grid grid-cols-1 gap-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{feature.title}</CardTitle>
                {feature.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                    <span className="text-pretty">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
