import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Step {
  title: string
  /** What raw data feeds this step. */
  entrada: string
  /** Exactly how it's processed — kept in sync with the actual code, not a paraphrase of intent. */
  proceso: string[]
  /** Optional caveat specific to this step. */
  nota?: string
}

const STEPS: Step[] = [
  {
    title: "1. Pendiente del terreno",
    entrada: "Elevación del DEM Copernicus GLO-30, vía la API gratuita de elevación de Open-Meteo (sin clave, un valor por coordenada).",
    proceso: [
      "Por cada centroide de vereda se consultan 5 puntos: el centroide y sus 4 vecinos cardinales (norte, sur, este, oeste) desplazados ~500 m.",
      "Se calcula el gradiente norte-sur y el gradiente este-oeste por diferencias finitas: atan(|Δelevación| / distancia) para cada eje.",
      "La pendiente final es el mayor de los dos gradientes, en grados.",
      "Para el puntaje, la pendiente se acota a 45°: 45° o más equivale a un puntaje de pendiente de 1.0 (pendiente_score = min(1, pendiente° / 45)).",
    ],
    nota: "Open-Meteo no ofrece un endpoint de pendiente directo — se deriva localmente de 5 lecturas de elevación por punto, no de una consulta ya calculada.",
  },
  {
    title: "2. Cercanía a la vía más cercana",
    entrada: "Red vial de OpenStreetMap (vías motorway, trunk, primary, secondary, tertiary, unclassified, residential, track y path) para toda el área de estudio, vía la API Overpass.",
    proceso: [
      "Una sola consulta Overpass por toda el área de estudio (no por vereda) recupera cada vértice de geometría de cada vía —no solo sus extremos— usando out geom.",
      "Para cada centroide se calcula la distancia Haversine al vértice más cercano de toda la red vial recuperada.",
      "El puntaje decrece linealmente con la distancia y llega a 0 al superar 1 km: vía_score = max(0, 1 − distancia_km / 1).",
    ],
    nota: "Es una aproximación al vértice más cercano, no la distancia exacta punto-a-línea — el error es despreciable porque OSM traza vías con vértices cada pocas decenas de metros, muy por debajo del radio de influencia de 1 km.",
  },
  {
    title: "3. Cercanía a una falla geológica",
    entrada:
      "Trazas de falla del Servicio Geológico Colombiano (SGC), capa \"Fallas\" del Atlas Geológico de Colombia, publicada como un FeatureServer de ArcGIS público y sin autenticación (tipo de falla y nombre por traza).",
    proceso: [
      "Una sola consulta por toda el área de estudio (envolvente de las tres municipalidades) recupera cada traza de falla que la intersecta, con su geometría completa de vértices (esri JSON \"paths\") — no solo sus extremos.",
      "Para cada centroide se calcula la distancia real punto-a-segmento (no al vértice más cercano) contra cada segmento de cada traza, proyectando localmente a kilómetros alrededor de la latitud del punto: se toma el mínimo sobre todos los segmentos de todas las trazas.",
      "El puntaje decrece linealmente con la distancia y llega a 0 al superar 2 km: falla_score = max(0, 1 − distancia_km / 2).",
    ],
    nota:
      "A diferencia de la cercanía a vías (donde el vértice más cercano es una aproximación aceptable porque OSM traza vías con vértices muy próximos), las trazas de falla del SGC tienen vértices mucho más espaciados sobre líneas mucho más largas — usar solo el vértice más cercano habría sobrestimado la distancia real a una traza que pasa cerca de un punto entre dos de sus vértices. Por eso este factor sí calcula la distancia real al segmento.",
  },
  {
    title: "4. Cercanía a un movimiento en masa histórico",
    entrada:
      "Inventario nacional de movimientos en masa del SGC (derivado de SIMMA), 55 puntos dentro del área de estudio, cada uno con tipo y subtipo (deslizamiento, caída, flujo, reptación, deformación gravitacional) pero sin fecha de ocurrencia confiable.",
    proceso: [
      "Una sola consulta por toda el área de estudio recupera cada punto del inventario que cae dentro de la envolvente de las tres municipalidades.",
      "Para cada centroide se calcula la distancia Haversine al punto más cercano de todo el inventario recuperado — a diferencia de las fallas, cada registro aquí es un evento puntual, no una traza continua, así que no hace falta la distancia punto-a-segmento.",
      "El puntaje decrece linealmente con la distancia y llega a 0 al superar 2 km: histórico_score = max(0, 1 − distancia_km / 2).",
    ],
    nota:
      "Es evidencia directa de inestabilidad pasada, no un proxy geomorfológico indirecto como los otros tres factores — por eso recibe el mayor peso del factor estático. Pero con solo 55 puntos dispersos y sin fecha en toda la zona de estudio, es un inventario disperso y no exhaustivo, no un catálogo completo de eventos: complementa a los otros factores, no los sustituye.",
  },
  {
    title: "5. Factor estático combinado",
    entrada: "Los cuatro puntajes anteriores.",
    proceso: [
      "Promedio ponderado: factor_estático = (pendiente_score × 0.35 + vía_score × 0.15 + falla_score × 0.2 + histórico_score × 0.3) / peso_total.",
      "Si alguno de los cuatro factores no se pudo calcular para una vereda (falla de red, chunk sin datos), el peso se renormaliza sobre los que sí estén disponibles, en vez de descartar la vereda entera.",
    ],
  },
  {
    title: "6. Disparador de lluvia reciente",
    entrada: "Precipitación diaria histórica de la API de archivo histórico de Open-Meteo (misma fuente que la climatología del mapa de precipitación), consultada una sola vez por centroide en un rango continuo de varios años.",
    proceso: [
      "Índice antecedente actual: suma ponderada por decaimiento de la lluvia diaria de los últimos 15 días, con vida media de 4 días — el día más reciente pesa más que el resto de la ventana (peso = 0.5^(días_atrás / 4)).",
      "Línea base histórica: se calcula el mismo índice de 15 días, con la misma fecha de cierre pero retrocedida 1, 2 y 3 años, y se promedian los tres resultados.",
      "Razón = índice actual / índice base. Si la base es 0 (sin lluvia histórica registrada en esa ventana), se trata como caso aparte: razón nula, con puntaje 1 si hay lluvia actual o 0 si no la hay.",
      "El puntaje del disparador satura en razón = 2 (el doble de lo normal para la época): disparador_score = clamp((razón − 1) / (2 − 1), 0, 1).",
    ],
    nota: "Compara contra la propia estacionalidad del punto, no contra un umbral absoluto de milímetros — una tormenta moderada en un mes normalmente seco puede pesar más que la misma tormenta en un mes normalmente lluvioso.",
  },
  {
    title: "7. Puntaje final y nivel de amenaza",
    entrada: "El factor estático (paso 5) y el disparador de lluvia (paso 6).",
    proceso: [
      "Puntaje final = (factor_estático × 0.6 + disparador_score × 0.4) / peso_total, con la misma renormalización de pesos si alguno de los dos factores falló.",
      "El puntaje 0–1 resultante se traduce al esquema de 5 niveles ya usado en toda la plataforma: Muy bajo (< 0.2), Bajo (< 0.4), Medio (< 0.6), Alto (< 0.8), Muy alto (≥ 0.8).",
      "Se calcula una sola vez por centroide de vereda (~55 en total entre Sevilla, Caicedonia y Zarzal) al resolver /api/veredas, no por punto de grilla.",
    ],
    nota: "Si absolutamente ningún factor resolvió para una vereda, el resultado es nulo en todos los campos — nunca un puntaje inventado — siguiendo la misma convención de \"sin datos\" que ya usaba la integración de RED LabOT para Zarzal.",
  },
]

const CACHES = [
  { fuente: "Elevación / pendiente", ttl: "30 días", motivo: "el terreno no cambia" },
  { fuente: "Red vial (Overpass)", ttl: "6 horas", motivo: "mismo caché que el resto de capas de OpenStreetMap" },
  { fuente: "Fallas geológicas (SGC)", ttl: "30 días", motivo: "la cartografía geológica no cambia" },
  { fuente: "Inventario de movimientos en masa (SGC)", ttl: "30 días", motivo: "es un inventario histórico estático" },
  { fuente: "Lluvia / disparador", ttl: "1 hora", motivo: "los días más recientes se revisan con nuevas observaciones" },
]

export function SectionMetodologia() {
  return (
    <section id="metodologia" className="flex flex-col gap-6 scroll-mt-24">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Metodología: modelo propio de amenaza por deslizamiento</h2>
          <Badge variant="outline">Cálculo propio, no un índice oficial</Badge>
        </div>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          El color del mapa de deslizamientos ya no proviene de una capa publicada por un tercero, sino de
          un modelo que esta misma app calcula en el servidor. Sigue, de forma simplificada, la estructura
          de NASA LHASA v1 (Stanley &amp; Kirschbaum, 2017): un factor estático de susceptibilidad del
          terreno combinado con un disparador dinámico de lluvia reciente. Esta sección documenta paso a
          paso qué dato entra en cada cálculo y exactamente cómo se procesa, para que el resultado sea
          auditable en vez de una caja negra.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {STEPS.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-base">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entrada</p>
                <p className="mt-1 text-pretty text-sm leading-relaxed text-foreground">{step.entrada}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Procesamiento</p>
                <ul className="mt-1 flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.proceso.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
                      <span className="text-pretty">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {step.nota && (
                <p className="rounded-md bg-muted/50 p-2.5 text-pretty text-xs leading-relaxed text-muted-foreground">
                  {step.nota}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold tracking-tight">Caché por factor</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Cada insumo del modelo se cachea de forma independiente, según qué tan rápido cambia — solo la
          primera solicitud dentro de cada ventana de caché paga el costo completo de recalcular los ~55
          centroides.
        </p>
        <dl className="grid grid-cols-1 gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-3">
          {CACHES.map((c) => (
            <div key={c.fuente}>
              <dt className="font-medium text-foreground">{c.fuente}</dt>
              <dd className="mt-0.5 text-muted-foreground">
                {c.ttl} — {c.motivo}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-lg font-semibold tracking-tight">Qué no es este modelo</h3>
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              No es una calibración validada contra deslizamientos ocurridos en la zona — los pesos y umbrales
              (0.35/0.15/0.2/0.3, 0.6/0.4, 45°, 1 km, 2 km, 2 km, razón de saturación 2) son elegidos por
              criterio propio siguiendo la estructura de LHASA v1, no ajustados con datos locales.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              LHASA v1 usa cinco predictores estáticos; este modelo reproduce tres de ellos (pendiente, vías y
              fallas geológicas) y suma un cuarto factor propio (movimientos en masa históricos) que LHASA v1
              no incluye. Cobertura de suelo (ESA WorldCover) — el único predictor de LHASA que sigue
              faltando — se evaluó pero se descartó: solo existe como archivo raster satelital (COG/GeoTIFF)
              sin una API de consulta por punto viable desde una función serverless. Geología/fallas y el
              inventario histórico se habían descartado por el mismo motivo hasta encontrar sus respectivas
              capas del SGC, que resultaron ser la excepción: vectores pequeños y directamente consultables,
              no rásteres.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              El inventario de movimientos históricos solo tiene 55 puntos en toda la zona de estudio y sin
              fecha de ocurrencia confiable — es evidencia real de inestabilidad pasada, pero disperso y no
              exhaustivo. Que una vereda quede lejos de los 55 puntos conocidos no significa que nunca haya
              tenido un movimiento en masa, solo que ninguno quedó registrado en este inventario.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              Se calcula en el centroide de cada vereda, no en una grilla densa — una sola pendiente y
              distancia a vía representan a toda la vereda, a diferencia de los ~11.721 puntos que sí tenía
              la capa de RED LabOT dentro de su área de cobertura.
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}
