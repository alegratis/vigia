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

const FLOOD_STEPS: Step[] = [
  {
    title: "1. Zonificación oficial",
    entrada:
      "Capa pública susceptibilidad_inundaciones (ArcGIS Online, RED LabOT) — polígonos disueltos con 5 clases de susceptibilidad, cubriendo el área zonificada de Sevilla y Caicedonia.",
    proceso: [
      "Para cada centroide de vereda se hace una prueba punto-en-polígono (turf) contra los polígonos de zonificación.",
      "Si el centroide cae dentro de un polígono, su clase (Muy alta/Alta/Moderada/Baja/Muy baja) se traduce a un puntaje 0–1: zonificación_score = 1 − índice_de_clase / 4 (Muy alta = 1, Muy baja = 0).",
      "Si el centroide no cae dentro de ningún polígono —el caso de las 19 veredas de Zarzal— el factor queda sin resolver, no en 0.",
    ],
    nota:
      "Es la única evidencia oficial directa que entra al modelo, por eso recibe el mayor peso individual (50%) — pero se limita a ese 50%, en vez de un peso mayor, precisamente para que una vereda sin esta cobertura (todo Zarzal) no quede con un puntaje degenerado por depender de un solo factor ausente.",
  },
  {
    title: "2. Cercanía a una quebrada o río",
    entrada:
      "Capa pública de hidrografía \"Quebradas\" (ArcGIS Online, mismo publicador que la zonificación oficial) — 19 cauces con nombre que cubren toda el área de estudio, incluida Zarzal.",
    proceso: [
      "Una sola consulta recupera las 19 trazas completas, con su geometría de vértices (esri JSON \"paths\").",
      "Para cada centroide se calcula la distancia real punto-a-segmento (no al vértice más cercano) contra cada segmento de cada traza, misma proyección local a kilómetros que usa el factor de fallas geológicas del modelo de deslizamiento — se toma el mínimo sobre todos los segmentos de todas las trazas.",
      "El puntaje decrece linealmente con la distancia y llega a 0 al superar 1 km: quebrada_score = max(0, 1 − distancia_km / 1).",
    ],
    nota:
      "Es el único factor del modelo que efectivamente llega a Zarzal: la capa de hidrografía no tiene el mismo vacío de cobertura que la zonificación oficial.",
  },
  {
    title: "3. Planicie del terreno",
    entrada: "El mismo valor de pendiente ya calculado por el modelo de amenaza por deslizamiento (paso 1 de esa metodología), en el mismo centroide.",
    proceso: [
      "No se vuelve a consultar la API de elevación: se reutiliza directamente el resultado ya calculado para ese centroide.",
      "A diferencia del modelo de deslizamiento, aquí el efecto se invierte — terreno plano cerca de un cauce se inunda con más facilidad; terreno empinado drena en vez de encharcar: planicie_score = 1 − min(1, pendiente° / 8).",
      "El puntaje llega a 0 a partir de 8° de pendiente — un umbral mucho más bajo que el de 45° del factor de pendiente del modelo de deslizamiento, porque aquí lo relevante es si el terreno puede retener agua, no si puede colapsar.",
    ],
  },
  {
    title: "4. Puntaje final y nivel de amenaza",
    entrada: "Los tres factores anteriores.",
    proceso: [
      "Promedio ponderado: puntaje_final = (zonificación_score × 0.5 + quebrada_score × 0.3 + planicie_score × 0.2) / peso_total.",
      "Si la zonificación oficial no resolvió para una vereda (fuera de su cobertura, o si el propio factor de zonificación falló al cargar), el peso se renormaliza sobre los otros dos — nunca se descarta la vereda entera solo por no tener zonificación oficial.",
      "El puntaje 0–1 resultante se traduce al mismo vocabulario de 5 niveles que ya usa la zonificación oficial (Muy alta/Alta/Moderada/Baja/Muy baja), en vez de inventar una escala nueva.",
      "Se calcula una sola vez por centroide de vereda (69 en total entre Sevilla, Caicedonia y Zarzal, incluyendo los cascos urbanos) al resolver /api/veredas.",
    ],
    nota:
      "Ninguna vereda queda sin puntaje: incluso sin zonificación oficial, los otros dos factores por sí solos ya producen un resultado no degenerado en toda vereda de Zarzal — es la extensión de cobertura que motivó este modelo.",
  },
]

const FLOOD_CACHES = [
  { fuente: "Zonificación oficial de inundación", ttl: "1 hora", motivo: "mismo caché que la capa pública original" },
  { fuente: "Hidrografía (quebradas y ríos)", ttl: "30 días", motivo: "el curso de un cauce cambia muy lentamente" },
  { fuente: "Pendiente / planicie", ttl: "reutilizada", motivo: "es el mismo valor ya cacheado por el modelo de deslizamiento" },
]

const FIRE_STEPS: Step[] = [
  {
    title: "1. Pendiente y cercanía a la vía más cercana (reutilizadas)",
    entrada: "Los mismos valores de pendiente y distancia a la vía más cercana ya calculados por el modelo de amenaza por deslizamiento (pasos 1 y 2 de esa metodología), en el mismo centroide.",
    proceso: [
      "No se vuelve a consultar la API de elevación ni Overpass: se reutilizan directamente los resultados ya calculados para ese centroide.",
      "pendiente_score = min(1, pendiente° / 45) — mismo tope de 45° que el modelo de deslizamiento: terreno más empinado propaga el fuego más rápido.",
      "vía_score = max(0, 1 − distancia_km / 1) — mismo radio de influencia de 1 km. La mayoría de los incendios forestales en Colombia son de origen humano (quemas agrícolas, fuego escapado), así que la cercanía a una vía es un indicio real de riesgo de ignición, no solo de propagación.",
    ],
  },
  {
    title: "2. Recurrencia histórica de incendios",
    entrada: "Detecciones activas VIIRS (375 m, fuente VIIRS_SNPP_NRT) de NASA FIRMS, paginadas hacia atrás en bloques de 5 días (el límite de la clave de este mapa) para cubrir una ventana de 150 días.",
    proceso: [
      "Se pagina el endpoint area/csv de FIRMS con su parámetro de fecha final, retrocediendo en bloques de 5 días hasta cubrir 150 días — hasta 30 solicitudes con concurrencia limitada (5 a la vez) en vez de una sola consulta.",
      "Para cada centroide se cuentan las detecciones dentro de 2 km, en toda la ventana de 150 días.",
      "El conteo se convierte a un puntaje 0–1 que satura en 3 detecciones o más: recurrencia_score = min(1, focos / 3).",
    ],
    nota: "Es evidencia directa de dónde ha ardido antes, no un indicio geomorfológico indirecto como los otros dos factores estáticos — por eso recibe el mayor peso del factor estático (60%), el mismo rol que cumple el inventario histórico de movimientos en masa en el modelo de deslizamiento.",
  },
  {
    title: "3. Factor estático combinado",
    entrada: "Los tres puntajes anteriores.",
    proceso: [
      "Promedio ponderado: factor_estático = (pendiente_score × 0.25 + vía_score × 0.15 + recurrencia_score × 0.6) / peso_total.",
      "Si alguno de los tres factores no se pudo calcular para una vereda, el peso se renormaliza sobre los que sí estén disponibles.",
    ],
  },
  {
    title: "4. Índice Meteorológico de Incendio (FWI) de hoy",
    entrada: "Temperatura máxima, humedad relativa mínima, viento máximo y lluvia diaria de los últimos 60 días por centroide, de la API de archivo histórico de Open-Meteo (misma fuente que el disparador de lluvia del modelo de deslizamiento).",
    proceso: [
      "Se calculan los tres códigos de humedad de combustible del Sistema Canadiense de Índices Forestales de Incendio (Van Wagner, 1987) día por día, en orden, arrancando desde los valores estándar de primavera del Servicio Forestal de Canadá (FFMC=85, DMC=6, DC=15): el Código de Humedad de Combustibles Finos (FFMC), el Código de Humedad de la Hojarasca (DMC) y el Código de Sequía (DC) — cada uno depende recursivamente del valor del día anterior.",
      "60 días de \"arranque\" antes de leer el valor de hoy — necesarios para que el DC (el código de decaimiento más lento) converja desde su valor inicial arbitrario, ya que este sistema no publica un valor de arranque propio para el trópico ecuatorial.",
      "Con los códigos de hoy ya calculados, se obtiene el Índice de Propagación Inicial (ISI, de FFMC y viento) y el Índice de Combustible Disponible (BUI, de DMC y DC), y con ambos el Índice Meteorológico de Incendio (FWI) final — las mismas ecuaciones, con los mismos números de ecuación y las mismas constantes, que la implementación de referencia en R del Servicio Forestal de Canadá (paquete cffdrs).",
      "El FWI se normaliza a un puntaje 0–1 que satura en FWI = 30 — el límite de la clase \"Extremo\" del sistema original de Van Wagner: fwi_score = min(1, FWI / 30).",
    ],
    nota: "Es la misma familia de ecuaciones detrás de la capa de pronóstico FWI de Copernicus GWIS/EFFIS ya disponible como superposición en este mapa — pero esa capa WMS no permite extraer un valor por punto (su GetCapabilities la marca queryable=\"0\", la misma limitación que ya tiene su capa de cobertura del suelo), así que este factor calcula las mismas ecuaciones de forma independiente a partir de datos meteorológicos crudos, en vez de leer el resultado de GWIS.",
  },
  {
    title: "5. Puntaje final y nivel de amenaza",
    entrada: "El factor estático (paso 3) y el FWI de hoy (paso 4).",
    proceso: [
      "Puntaje final = (factor_estático × 0.6 + fwi_score × 0.4) / peso_total, con la misma renormalización de pesos si alguno de los dos factores falló.",
      "El puntaje 0–1 resultante se traduce al mismo vocabulario de 4 niveles que ya usaba la capa oficial AmenazaIncendios (Muy bajo < 0.25, Bajo < 0.5, Medio < 0.75, Alto ≥ 0.75) y a los mismos tokens de color — sin introducir un quinto nivel ni nuevas variables CSS.",
      "Se calcula una sola vez por centroide de vereda (~69 en total entre Sevilla, Caicedonia y Zarzal) al resolver /api/veredas.",
    ],
    nota: "Si absolutamente ningún factor resolvió para una vereda, el resultado es nulo en todos los campos — nunca un puntaje inventado.",
  },
]

const FIRE_CACHES = [
  { fuente: "Pendiente / vía (reutilizadas)", ttl: "reutilizada", motivo: "mismo caché ya pagado por el modelo de deslizamiento" },
  { fuente: "Recurrencia histórica (NASA FIRMS)", ttl: "6 horas", motivo: "una ventana pasada de detecciones no cambia una vez publicada" },
  { fuente: "Meteorología / FWI", ttl: "1 hora", motivo: "los días más recientes se revisan con nuevas observaciones" },
]

const COMPOUND_STEPS: Step[] = [
  {
    title: "1. Normalización de cada amenaza a 0–1",
    entrada:
      "Los cinco modelos de amenaza que esta app ya calcula por vereda: deslizamientos, inundaciones, incendios forestales y sismología (cada uno con su propio puntaje 0–1 continuo) y precipitación (solo con un nivel de 4 categorías, sin puntaje continuo propio).",
    proceso: [
      "Deslizamientos, inundaciones e incendios: se reutiliza directamente el puntaje 0–1 ya calculado por cada modelo propio — nunca se recalcula.",
      "Precipitación (4 niveles: Bajo/Moderado/Alto/Muy alto): sin puntaje continuo publicado, se usa el índice ordinal del nivel sobre el total de niveles como puntaje sustituto — la misma técnica que el modelo de inundación ya usa para traducir la clase de zonificación oficial a un puntaje.",
      "Incendios se resuelve en el mismo centroide de vereda que los otros cuatro directamente desde aggregateVeredas() (lib/veredas/aggregate.ts), que ya calcula el modelo propio de incendios junto con los de deslizamiento e inundación — no hace falta un cruce aparte contra ninguna capa oficial.",
      "Precipitación reutiliza /api/precipitacion/amenaza en su modo histórico de 7 días con NASA POWER, ya calculado por vereda.",
      "Sismología: sin zonificación por vereda publicada, se calcula un puntaje propio de exposición por decaimiento espacial desde los epicentros de USGS (en vivo) y SGC (histórico) — ver lib/sismologia/exposure-score.ts.",
    ],
    nota:
      "Ninguna de las cinco amenazas se recalcula desde cero — el módulo compuesto solo importa y combina las funciones ya exportadas por cada categoría existente (sismología incluida, con su propio módulo de exposición).",
  },
  {
    title: "2. Nivel compuesto: la amenaza más alta gobierna",
    entrada: "Los cinco puntajes normalizados del paso 1.",
    proceso: [
      "Cada puntaje normalizado se traduce individualmente al mismo esquema de 5 niveles usado en toda la plataforma (Muy bajo <0.2, Bajo <0.4, Moderado <0.6, Alto <0.8, Muy alto ≥0.8).",
      "El nivel compuesto de la vereda es el mayor de esos cinco niveles — no un promedio — siguiendo la doctrina de la OMM y GDACS (Global Disaster Alert and Coordination System) de que la amenaza más severa determina la alerta general, sin diluirla con amenazas más tranquilas.",
      "La amenaza \"dominante\" reportada es la que alcanzó ese nivel máximo (en caso de empate entre niveles, la de mayor puntaje normalizado).",
    ],
  },
  {
    title: "3. Puntaje compuesto: promedio ponderado al estilo INFORM",
    entrada: "Los mismos cinco puntajes normalizados del paso 1.",
    proceso: [
      "Puntaje compuesto = promedio ponderado de los cinco puntajes, con peso igual de 20% cada uno por defecto — al estilo del Índice de Riesgo INFORM (composición ponderada de componentes de riesgo).",
      "Si una amenaza no tiene datos para una vereda (p. ej. incendios fuera de su cobertura en Sevilla/Caicedonia, o precipitación sin lectura válida), su peso se renormaliza sobre las que sí resolvieron — la misma convención de \"sin datos nunca inventados\" que usa cada modelo individual. Sismología siempre resuelve (es un fenómeno regional, no zonificado), por lo que casi nunca deja de aportar su 20%.",
      "Este puntaje no define el nivel compuesto (eso lo hace el paso 2) — solo ordena veredas dentro de un mismo nivel para color de intensidad o priorización relativa.",
    ],
  },
  {
    title: "4. Marco de acción IDEAM y narrativa",
    entrada: "El nivel compuesto del paso 2.",
    proceso: [
      "El nivel se traduce a las tres categorías de acción que IDEAM ya usa en sus boletines públicos: Informar (Muy bajo/Bajo), Prepararse (Moderado), Actuar (Alto/Muy alto).",
      "Un reporte narrativo en español se genera con plantillas de texto deterministas (lib/riesgo-compuesto/narrative.ts) rellenadas con los números ya calculados — nunca con un modelo de lenguaje: un resumen de una línea (nivel + amenaza dominante), un desglose por amenaza y un párrafo de exposición demográfica (reutilizando los mismos conteos de población/infraestructura de RED LabOT que ya usa /api/veredas).",
    ],
    nota: "Cero riesgo de alucinación y sin necesidad de una nueva integración de IA: es texto de plantilla, no generación de lenguaje.",
  },
]

const COMPOUND_CACHES = [
  { fuente: "Deslizamientos e inundaciones", ttl: "reutilizada", motivo: "mismo caché que cada modelo individual (vía aggregateVeredas)" },
  { fuente: "Incendios forestales (cruce por centroide)", ttl: "1 hora", motivo: "mismo caché que la capa AmenazaIncendios original" },
  { fuente: "Precipitación (NASA POWER, 7 días)", ttl: "3 horas", motivo: "mismo caché que /api/precipitacion/amenaza" },
  { fuente: "Sismología (USGS en vivo / SGC histórico)", ttl: "5 min / 1 día", motivo: "mismo caché que /api/sismologia/eventos" },
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

      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Metodología: modelo propio de amenaza por inundación</h2>
          <Badge variant="outline">Cálculo propio, no un índice oficial</Badge>
        </div>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          La capa &quot;Modelo propio de inundación&quot; del mapa de inundaciones extiende la zonificación
          oficial de RED LabOT —que solo cubre el área zonificada de Sevilla y Caicedonia— a los tres
          municipios, incluido Zarzal, calculando un puntaje propio por vereda. La zonificación oficial no
          se descarta: es, al contrario, el insumo de mayor peso del modelo, donde tiene cobertura.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {FLOOD_STEPS.map((step) => (
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
        <dl className="grid grid-cols-1 gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-3">
          {FLOOD_CACHES.map((c) => (
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
              No es un modelo hidráulico ni hidrológico — no simula caudal, láminas de agua ni tiempos de
              llegada de una creciente. Es una susceptibilidad relativa por vereda, del mismo tipo que la
              zonificación oficial que extiende, no un pronóstico de inundación (para eso está el pronóstico
              de caudal en vivo de GEOGLOWS, ya en el mismo mapa).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              La capa de hidrografía usada para el factor de cercanía a cauces solo tiene 19 trazas con
              nombre — es una aproximación a la red de drenaje real, no un mapa completo de todo arroyo o
              canal menor.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              Los pesos y umbrales (0.5/0.3/0.2, 1 km, 8°) son elegidos por criterio propio, siguiendo la
              misma lógica de factores-por-distancia-e-inclinación del modelo de deslizamiento, no ajustados
              con datos locales de inundaciones ocurridas.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              Cada traza de cauce de la capa de hidrografía trae también un identificador (rivid) que
              coincide con el esquema de tramos que ya usa el pronóstico de GEOGLOWS en este mapa — un
              posible factor dinámico futuro (p. ej. ponderar por el período de retorno en vivo del tramo
              más cercano), señalado aquí pero no implementado: a diferencia de cada otro insumo de este
              modelo, que es una sola consulta cacheada, eso implicaría decenas de consultas individuales por
              tramo en cada solicitud.
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Metodología: modelo propio de amenaza por incendios forestales</h2>
          <Badge variant="outline">Cálculo propio, no un índice oficial</Badge>
        </div>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          El color del mapa de incendios ya no proviene de la zonificación oficial (PBOT 2014,
          `AmenazaIncendios`) — a diferencia de las capas de zonificación que sí siguen aportando al modelo
          de deslizamiento y de inundación, esa capa es una digitalización estática de un plan de uso del
          suelo de 2014, sin ningún modelo computacional detrás que replicar. En su lugar, esta sección
          documenta el modelo propio que esta misma app calcula: pendiente y cercanía a vías (reutilizadas
          del modelo de deslizamiento), recurrencia histórica de NASA FIRMS y el Índice Meteorológico de
          Incendio (FWI) de hoy, calculado con las ecuaciones estándar del Sistema Canadiense de Índices
          Forestales de Incendio (Van Wagner, 1987) — el mismo sistema detrás de la capa de pronóstico FWI
          de Copernicus GWIS/EFFIS ya disponible en el mapa, pero calculado aquí de forma independiente a
          partir de datos meteorológicos crudos.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {FIRE_STEPS.map((step) => (
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
        <dl className="grid grid-cols-1 gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-3">
          {FIRE_CACHES.map((c) => (
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
              No es una calibración validada contra incendios ocurridos en la zona — los pesos y umbrales
              (0.25/0.15/0.6, 0.6/0.4, 45°, 1 km, 2 km, 3 detecciones, FWI = 30, 60 días de arranque) son
              elegidos por criterio propio siguiendo la misma estructura de factor estático + disparador
              dinámico que el modelo de deslizamiento, no ajustados con datos locales de incendios ocurridos.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              Las ecuaciones del FWI en sí no son una invención de esta app — son el sistema estándar
              publicado por el Servicio Forestal de Canadá (Van Wagner, 1987), transcritas ecuación por
              ecuación desde la implementación de referencia en R (paquete cffdrs). Lo que sí es propio de
              esta app es calcularlas aquí, en vez de leerlas de la capa WMS de GWIS/EFFIS (que no permite
              extraer un valor por punto), y los 60 días de arranque elegidos para esta latitud ecuatorial,
              para los que el sistema no publica un valor de referencia.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              La ventana de recurrencia histórica (150 días, solo VIIRS_SNPP_NRT) es una muestra de
              detecciones activas recientes, no un catálogo completo de todo incendio ocurrido alguna vez
              en la zona — un incendio anterior a esa ventana, o detectado solo por otro satélite, no cuenta
              hacia este factor.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              Se calcula en el centroide de cada vereda, no en una grilla densa — un solo valor de FWI y un
              solo conteo de recurrencia representan a toda la vereda.
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Metodología: riesgo compuesto (multiamenaza)</h2>
          <Badge variant="outline">Cálculo propio, no un índice oficial</Badge>
        </div>
        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          La capa &quot;Riesgo compuesto&quot; combina las cinco amenazas que esta app ya modela por
          vereda —deslizamientos, inundaciones (modelo propio), incendios forestales (modelo propio),
          precipitación y
          sismología— en una sola evaluación, siguiendo dos enfoques ya usados en la práctica internacional
          en vez de inventar
          uno nuevo: la doctrina de la OMM/GDACS de que &quot;la amenaza más alta gobierna&quot; para el
          nivel de alerta, y la composición ponderada al estilo del Índice de Riesgo INFORM para un puntaje
          continuo de referencia. El resultado se traduce además al marco de acción
          Informar/Prepararse/Actuar que ya usa IDEAM en Colombia.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {COMPOUND_STEPS.map((step) => (
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
        <h3 className="text-lg font-semibold tracking-tight">Caché por insumo</h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Este módulo no introduce nuevas fuentes externas — cada insumo hereda el caché que ya tenía en su
          propia categoría.
        </p>
        <dl className="grid grid-cols-1 gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-3">
          {COMPOUND_CACHES.map((c) => (
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
              No incluye el pronóstico de caudal en vivo de GEOGLOWS. Ese pronóstico es por tramo de río, no
              por vereda, y cruzarlo con ~55 veredas exigiría decenas de consultas de identificación de tramo
              en vivo por solicitud — una integración pesada y frágil fuera del alcance de esta primera
              versión. La amenaza &quot;inundaciones&quot; en el riesgo compuesto es, en cambio, el modelo
              propio de inundación por vereda (zonificación + cercanía a cauce + planicie del terreno) que
              ya representa esa amenaza en las otras tres categorías.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              No usa un modelo de lenguaje ni la puerta de enlace de IA de esta app. El reporte narrativo es
              texto de plantilla determinista, relleno con los mismos números que ya se muestran en el mapa
              y el panel — nunca generación libre.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              Los pesos iguales de 25% por amenaza y los umbrales de nivel (0.2/0.4/0.6/0.8) son una elección
              de diseño razonable, no una calibración validada contra eventos multiamenaza ocurridos en la
              zona — igual que cada modelo individual que combina.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
            <span className="text-pretty">
              Precipitación no tiene un puntaje continuo propio publicado, así que su contribución al
              puntaje compuesto es una aproximación ordinal (índice de nivel entre los niveles totales), a
              diferencia de deslizamientos, inundaciones e incendios, que sí aportan una medida continua
              nativa de su propio modelo.
            </span>
          </li>
        </ul>
      </div>
    </section>
  )
}
