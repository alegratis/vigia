import type { LayerKey } from "@/lib/laboratorio/layers"

export interface MethodFactor {
  name: string
  /** Share of the score this factor carries (e.g. "35 %"), when it is a weighted input. */
  weight?: string
  detail: string
}

export interface MethodSection {
  title: string
  intro?: string
  factors?: MethodFactor[]
  bullets?: string[]
}

export interface LayerMethodology {
  summary: string
  sources: string[]
  /** Ordered steps from raw data to what the map paints. */
  flow: string[]
  sections: MethodSection[]
  limitations: string[]
}

const SCALE_5 = "Muy bajo < 0,2 · Bajo < 0,4 · Medio < 0,6 · Alto < 0,8 · Muy alto ≥ 0,8"

export const LAYER_METHODOLOGY: Record<LayerKey, LayerMethodology> = {
  deslizamientos: {
    summary:
      "Modelo propio, calculado en el centroide de cada vereda, que sigue la estructura de LHASA v1 de la NASA: un factor estático de terreno combinado con un disparador dinámico de lluvia reciente. No es un índice oficial.",
    sources: [
      "Copernicus DEM vía Open-Meteo (pendiente)",
      "OpenStreetMap / Overpass (vías)",
      "Servicio Geológico Colombiano, Atlas Geológico (trazas de fallas)",
      "SGC, inventario nacional de movimientos en masa (SIMMA)",
      "Open-Meteo Archive (lluvia diaria)",
    ],
    flow: [
      "Se calcula el centroide de cada vereda (unas 55 en Sevilla, Caicedonia y Zarzal).",
      "Para cada centroide se consultan la pendiente, la distancia a la vía más cercana, la distancia a la falla más cercana y la distancia al movimiento en masa documentado más cercano.",
      "Cada factor se convierte a una escala de 0 a 1, donde 1 es la peor condición.",
      "Los cuatro factores se combinan en un puntaje estático (60 % del total).",
      "Aparte se calcula el disparador de lluvia (40 % del total) a partir de la lluvia de los últimos 15 días.",
      "El puntaje final se corta en cinco niveles y se sirve junto con el resto de datos de la vereda.",
    ],
    sections: [
      {
        title: "Factor estático (60 %)",
        intro: "Promedio ponderado de cuatro factores. Si alguno no se puede resolver, los pesos se re-normalizan sobre los que sí.",
        factors: [
          {
            name: "Pendiente del terreno",
            weight: "35 %",
            detail: "Crece linealmente de 0° a 45°. A partir de 45° el factor ya vale 1.",
          },
          {
            name: "Movimientos en masa históricos",
            weight: "30 %",
            detail:
              "Distancia al registro documentado más cercano. Pesa más porque es evidencia directa de inestabilidad pasada. Deja de contar a más de 2 km.",
          },
          {
            name: "Fallas geológicas",
            weight: "20 %",
            detail: "Distancia a la traza de falla más cercana. Deja de contar a más de 2 km.",
          },
          {
            name: "Proximidad a vías",
            weight: "15 %",
            detail: "Los cortes de talud para vías desestabilizan laderas. Deja de contar a más de 1 km.",
          },
        ],
      },
      {
        title: "Disparador de lluvia (40 %)",
        intro:
          "Mide si hoy llueve más de lo normal para esta época, no cuánta lluvia cayó en términos absolutos.",
        bullets: [
          "Se suma la lluvia diaria de los últimos 15 días, dándole más peso a los días recientes (el peso se reduce a la mitad cada 4 días).",
          "Ese índice se divide entre el promedio del mismo periodo del calendario en los 3 años anteriores.",
          "Una razón de 1 significa condiciones normales. Con una razón de 2 o más el disparador vale 1.",
          "Si no hay datos de lluvia, se asume que no hay anomalía (vale 0) en lugar de omitir el factor.",
        ],
      },
      {
        title: "Niveles",
        bullets: [SCALE_5],
      },
    ],
    limitations: [
      "El resultado es un valor puntual en el centroide, no un promedio de toda la vereda.",
      "La cobertura del suelo (ESA WorldCover) se descartó porque solo se publica como ráster sin API de consulta por punto.",
      "El inventario histórico tiene pocos puntos y sin fecha, por lo que complementa a los otros factores pero no los reemplaza.",
      "El panel de población expuesta lee RED LabOT directamente, no este modelo.",
    ],
  },

  inundaciones: {
    summary:
      "Modelo propio de susceptibilidad por vereda. Extiende la zonificación oficial de inundaciones, que solo cubre parte de Sevilla y Caicedonia, para que también llegue a Zarzal.",
    sources: [
      "Capa oficial susceptibilidad_inundaciones (zonificación)",
      "Trazas de quebradas y corrientes nombradas",
      "Pendiente ya calculada para el modelo de deslizamientos",
    ],
    flow: [
      "Se calcula el centroide de cada vereda.",
      "Se comprueba si el centroide cae dentro de un polígono de la zonificación oficial y, de ser así, se toma su clase.",
      "Se mide la distancia a la quebrada más cercana.",
      "Se reutiliza la pendiente del modelo de deslizamientos, sin volver a consultarla.",
      "Los factores disponibles se combinan con pesos re-normalizados y el resultado se corta en cinco niveles.",
    ],
    sections: [
      {
        title: "Factores",
        factors: [
          {
            name: "Zonificación oficial",
            weight: "50 %",
            detail:
              "La clase oficial se convierte a 0–1 (Muy alta = 1, Muy baja = 0). Es la única evidencia oficial directa, pero solo existe dentro de la zona cubierta.",
          },
          {
            name: "Cercanía a quebradas",
            weight: "30 %",
            detail:
              "Distancia real al segmento de quebrada más cercano. Es 1 junto al cauce y baja linealmente hasta 0 a 1 km. Es el único factor que llega a Zarzal.",
          },
          {
            name: "Planitud del terreno",
            weight: "20 %",
            detail: "Terreno plano retiene agua, el pendiente la evacúa. Vale 1 con pendiente 0° y 0 a partir de 8°.",
          },
        ],
      },
      {
        title: "Veredas sin zonificación",
        intro:
          "Todas las veredas de Zarzal quedan fuera de la zonificación oficial. En ese caso los pesos se re-normalizan sobre cercanía a quebradas y planitud, así que igual reciben un puntaje.",
      },
      {
        title: "Niveles",
        bullets: ["Muy baja < 0,2 · Baja < 0,4 · Moderada < 0,6 · Alta < 0,8 · Muy alta ≥ 0,8"],
      },
    ],
    limitations: [
      "Es un modelo estático. No incluye lluvia ni caudal del momento.",
      "El pronóstico de caudal de ríos (GEOGLOWS) es una capa aparte en el mapa de inundaciones y no entra en este puntaje.",
      "No es un índice publicado: la clase oficial pesa 50 % a propósito para que las veredas sin zonificación no queden sin resultado.",
    ],
  },

  incendios: {
    summary:
      "Modelo propio de amenaza de incendio forestal por vereda. Reemplaza la capa AmenazaIncendios de RED LabOT, que era una digitalización estática de la zonificación del PBOT de 2014 y no un cálculo.",
    sources: [
      "NASA FIRMS, detecciones VIIRS (historial de focos)",
      "Open-Meteo Archive (clima para el Índice de Peligro de Incendio)",
      "Pendiente y distancia a vías reutilizadas del modelo de deslizamientos",
    ],
    flow: [
      "Se calcula el centroide de cada vereda.",
      "Se descargan en bloque todas las detecciones de focos de los últimos 150 días del área de estudio.",
      "Por cada centroide se cuentan los focos cercanos y se calcula el índice de peligro del día (FWI).",
      "Se combinan pendiente, vías e historial de focos en el factor estático (60 %).",
      "Se mezcla con el FWI de hoy (40 %) y el resultado se corta en cuatro niveles.",
    ],
    sections: [
      {
        title: "Factor estático (60 %)",
        factors: [
          {
            name: "Recurrencia de focos",
            weight: "60 %",
            detail:
              "Focos VIIRS en los últimos 150 días a menos de 2 km del centroide. Con 3 detecciones el factor ya vale 1. Es el de mayor peso porque es evidencia directa de dónde ya ha ardido.",
          },
          {
            name: "Pendiente",
            weight: "25 %",
            detail: "El fuego se propaga más rápido ladera arriba. Crece de 0° a 45°.",
          },
          {
            name: "Proximidad a vías",
            weight: "15 %",
            detail:
              "La mayoría de incendios en Colombia son de origen humano (quemas agrícolas, fuegos que se escapan), así que la cercanía a una vía es un indicador de riesgo de ignición. Deja de contar a más de 1 km.",
          },
        ],
      },
      {
        title: "Factor dinámico: FWI de hoy (40 %)",
        intro:
          "Se calcula con las ecuaciones estándar del Sistema Canadiense de Índice de Peligro de Incendio (FWI), no se lee de la capa de GWIS porque esa solo se publica como teselas.",
        bullets: [
          "Entradas: temperatura, humedad, viento y lluvia diarios de Open-Meteo.",
          "El cálculo arranca 60 días antes con valores iniciales estándar (FFMC 85, DMC 6, DC 15) para que la humedad del combustible esté estabilizada.",
          "Un FWI de 30 o más satura el factor en 1.",
        ],
      },
      {
        title: "Niveles",
        bullets: ["Muy bajo < 0,25 · Bajo < 0,5 · Medio < 0,75 · Alto ≥ 0,75"],
      },
    ],
    limitations: [
      "Solo hay cuatro niveles, el vocabulario heredado de AmenazaIncendios.",
      "Si falla la consulta de focos o la de clima, los pesos se re-normalizan en vez de dar un resultado inventado.",
      "El puntaje estático (sin el clima del día) es el que usa el sistema de alertas como filtro de susceptibilidad.",
    ],
  },

  precipitacion: {
    summary:
      "Lluvia acumulada o pronosticada por vereda, clasificada en cuatro niveles. Es un dato de contexto, no un modelo de amenaza calibrado.",
    sources: [
      "Open-Meteo (acumulado histórico y pronóstico)",
      "IDEAM (estaciones, como fuente alterna del acumulado histórico)",
    ],
    flow: [
      "Se calcula el centroide de cada vereda.",
      "Según el modo elegido, se consulta una sola vez por centroide: acumulado histórico con Open-Meteo, acumulado histórico con estaciones IDEAM, o pronóstico con Open-Meteo.",
      "Se suman los milímetros de la ventana elegida (7, 14, 30 días, etc.).",
      "El total se compara con los umbrales, escalados a la longitud de la ventana, y se asigna un nivel.",
    ],
    sections: [
      {
        title: "Niveles (base de 7 días)",
        factors: [
          { name: "Bajo", weight: "< 35 mm", detail: "Lluvia ligera o moderada acumulada en la semana." },
          { name: "Moderado", weight: "35 – 75 mm", detail: "" },
          { name: "Alto", weight: "75 – 150 mm", detail: "" },
          { name: "Muy alto", weight: "≥ 150 mm", detail: "" },
        ],
      },
      {
        title: "Escalado por ventana",
        intro:
          "Los umbrales se multiplican por (días de la ventana ÷ 7). Así un acumulado de 30 días o un pronóstico de 14 días no se clasifica como más grave solo por abarcar más días. Por ejemplo, con 14 días los cortes pasan a 70, 150 y 300 mm.",
      },
      {
        title: "Fuentes",
        factors: [
          {
            name: "Open-Meteo",
            detail: "Cubre las tres municipalidades con la misma calidad, incluida Zarzal. Es la fuente por defecto.",
          },
          {
            name: "IDEAM",
            detail:
              "Usa la estación más cercana y muestra su nombre y distancia. Las 2 estaciones cercanas no alcanzan Sevilla ni Caicedonia, por lo que esas veredas aparecen sin cobertura.",
          },
          {
            name: "Pronóstico",
            detail: "Open-Meteo hacia adelante. Además del acumulado informa la probabilidad máxima de lluvia.",
          },
        ],
      },
    ],
    limitations: [
      "Ningún estándar colombiano define umbrales fijos en milímetros. Las bandas son una heurística adaptada de las categorías de intensidad de la OMM/AMS, no curvas IDF del IDEAM.",
      "Es un valor puntual en el centroide de la vereda.",
      "Las gráficas de climatología decadal y quinquenal muestran el histórico de la vereda seleccionada, no entran en el nivel del mapa.",
    ],
  },

  clima: {
    summary:
      "Reporte meteorológico convencional por vereda: condiciones actuales, banda de temperatura, pronóstico a 7 días y perspectiva de días secos.",
    sources: ["Open-Meteo (condiciones actuales y pronóstico diario)"],
    flow: [
      "Se calcula el centroide de cada vereda.",
      "Se consulta Open-Meteo una vez por centroide.",
      "Se obtienen temperatura, sensación térmica y código del tiempo actuales, y para cada uno de los próximos 7 días máxima, mínima, probabilidad y milímetros de lluvia.",
      "El código del tiempo (estándar OMM) se agrupa en un tipo de clima para el ícono.",
      "La temperatura actual se clasifica en cinco bandas.",
      "El titular de cada municipio se toma del punto de su casco urbano.",
    ],
    sections: [
      {
        title: "Bandas de temperatura actual",
        bullets: ["Frío < 14 °C · Fresco < 18 °C · Templado < 22 °C · Cálido < 26 °C · Caluroso ≥ 26 °C"],
      },
      {
        title: "Día seco y racha seca",
        bullets: [
          "Un día cuenta como seco si se pronostican menos de 1 mm de lluvia.",
          "La racha seca es la cantidad de días secos consecutivos desde hoy, hasta el primer día con lluvia.",
        ],
      },
    ],
    limitations: [
      "Es un pronóstico de modelo, no una medición de estación.",
      "Las bandas de temperatura son fijas y no tienen en cuenta la altitud, aunque las veredas van de zonas bajas a cordillera.",
      "Las gráficas decadal y quinquenal son climatología histórica de la vereda seleccionada.",
    ],
  },

  demografia: {
    summary:
      "Vista simplificada de población por vereda, normalizada en cinco niveles. Muestra dónde vive más gente, no qué tan vulnerable es.",
    sources: ["Campo de población que ya entrega /api/veredas"],
    flow: [
      "Se toma la población de cada vereda cargada.",
      "Se calculan el mínimo y el máximo entre las veredas visibles.",
      "Cada población se normaliza a 0–1 con (valor − mínimo) ÷ (máximo − mínimo).",
      "El valor normalizado se corta en cinco niveles y se pinta.",
    ],
    sections: [
      {
        title: "Niveles",
        bullets: ["Muy bajo < 0,2 · Bajo < 0,4 · Moderado < 0,6 · Alto < 0,8 · Muy alto ≥ 0,8"],
      },
      {
        title: "Lectura relativa",
        intro:
          "El nivel es relativo al conjunto de veredas cargadas. Una vereda es Muy alto porque está cerca del máximo de esa muestra, no porque supere un umbral fijo de habitantes. Si todas tienen la misma población, se muestran como Moderado.",
      },
      {
        title: "Qué no incluye esta capa: el IVS",
        intro:
          "En el resto de la plataforma la vulnerabilidad se mide con un Índice de Vulnerabilidad Social (IVS) con datos del censo DANE 2018, que esta capa no calcula:",
        factors: [
          { name: "Vivienda", weight: "25 %", detail: "Paredes, pisos y hacinamiento." },
          { name: "Servicios públicos", weight: "25 %", detail: "Acueducto, alcantarillado, energía y recolección de basuras." },
          { name: "Educación", weight: "20 %", detail: "Hogares con inasistencia escolar de niños de 6 a 17 años." },
          { name: "Trabajo", weight: "15 %", detail: "Hogares con alta dependencia económica." },
        ],
        bullets: [
          "Los pesos suman 0,85 y se dividen entre 0,85 para volver a sumar 1. La dimensión de salud se excluyó porque DANE no publica ese dato a nivel municipal para estos municipios.",
          "El riesgo combinado es IVS × puntaje de amenaza (de 1 a 4).",
        ],
      },
    ],
    limitations: [
      "No es el IVS completo de producción, que trabaja a nivel de manzana.",
      "La población por sí sola no mide vulnerabilidad: una vereda grande con buena infraestructura puntúa igual que una con carencias.",
      "En el IVS, las veredas rurales heredan el valor de su municipio porque DANE no publica nada más fino para zona dispersa.",
    ],
  },

  "riesgo-compuesto": {
    summary:
      "Combina cinco amenazas por vereda en un solo resultado: deslizamientos, inundaciones, incendios, precipitación y sismología. No usa fuentes nuevas, solo los resultados ya calculados de las otras capas.",
    sources: [
      "Resultados de los modelos de deslizamientos, inundaciones e incendios",
      "Nivel de precipitación del acumulado",
      "Puntaje de exposición sísmica (ver Sismología)",
    ],
    flow: [
      "Cada amenaza se lleva a una escala común de 0 a 1.",
      "Se calculan dos resultados a la vez: un nivel (el peor gana) y un puntaje (promedio).",
      "El nivel se corta en cinco categorías y se registra cuál amenaza lo determinó.",
    ],
    sections: [
      {
        title: "Cómo se normaliza cada amenaza",
        factors: [
          { name: "Deslizamientos", detail: "Se usa su puntaje continuo de 0 a 1 tal cual." },
          { name: "Inundaciones", detail: "Se usa su puntaje continuo de 0 a 1 tal cual." },
          { name: "Incendios", detail: "Se usa su puntaje continuo de 0 a 1 tal cual." },
          {
            name: "Precipitación",
            detail: "No tiene puntaje continuo: se usa la posición de su nivel (Bajo = 0, Moderado = 1/3, Alto = 2/3, Muy alto = 1).",
          },
          { name: "Sismología", detail: "Se usa su puntaje de exposición de 0 a 1 tal cual." },
        ],
      },
      {
        title: "Nivel: el peor gana",
        intro:
          "Sigue la lógica de los sistemas de alerta de la OMM y GDACS. El nivel de la vereda es el más alto entre sus amenazas, para que una amenaza severa no quede diluida por otras tranquilas. Si dos amenazas empatan en nivel, gana la de mayor puntaje, y esa se muestra como amenaza dominante.",
      },
      {
        title: "Puntaje: promedio ponderado",
        intro:
          "Al estilo del índice INFORM, cada amenaza pesa 20 %. Si una no se pudo resolver, los pesos se re-normalizan sobre las demás. Es el valor continuo que se usa para ordenar las veredas en el panel derecho.",
      },
      {
        title: "Niveles",
        bullets: ["Muy bajo < 0,2 · Bajo < 0,4 · Moderado < 0,6 · Alto < 0,8 · Muy alto ≥ 0,8"],
      },
    ],
    limitations: [
      "Con el nivel que usa el peor caso, una sola amenaza alta basta para elevar la vereda, aunque las otras estén bajas.",
      "Las cinco amenazas pesan igual en el promedio, sin ajustar por su frecuencia ni por sus consecuencias.",
      "No incluye vulnerabilidad ni exposición de población: mide amenaza, no riesgo en sentido estricto.",
    ],
  },

  sismologia: {
    summary:
      "Eventos sísmicos recientes y puntaje de exposición por vereda. Combina el Servicio Geológico Colombiano y USGS, sin restricción de municipio: los epicentros pueden caer fuera de cualquier vereda del área de estudio.",
    sources: [
      "SGC RSNC en vivo (fuente principal, detecta sismos pequeños M1–M4)",
      "USGS FDSN (verificación independiente de 90 días)",
      "SGC, catálogo histórico (archivo profundo)",
    ],
    flow: [
      "Las tres fuentes se consultan en paralelo para el área entre las latitudes 3,4 y 5,2 y las longitudes −76,6 y −75,2.",
      "Si una fuente falla, las otras siguen funcionando.",
      "Se eliminan duplicados: dos registros son el mismo sismo si difieren menos de 40 segundos, menos de 60 km y menos de 1,5 en magnitud.",
      "Cuando hay duplicado se conserva el registro del SGC en vivo, luego el del SGC histórico y por último el de USGS.",
      "Con el conjunto resultante se calcula la exposición de cada vereda y se dibujan los epicentros.",
    ],
    sections: [
      {
        title: "Magnitud de cada evento",
        bullets: [
          "Micro < 3,0 · Menor 3,0–3,9 · Ligero 4,0–4,9 · Moderado 5,0–5,9 · Fuerte ≥ 6,0 (clases estándar de USGS).",
          "Los eventos de magnitud 2,5 o mayor se dibujan con círculo numerado. Los menores aparecen como puntos pequeños y tenues.",
        ],
      },
      {
        title: "Exposición por vereda",
        intro:
          "No existe una zonificación sísmica por vereda publicada, así que se calcula a partir de los epicentros cercanos:",
        factors: [
          {
            name: "Energía del evento",
            detail: "Cada sismo pesa 10^(0,5 × magnitud), la escala relativa estándar de energía liberada.",
          },
          {
            name: "Distancia",
            detail:
              "La influencia cae como 1 ÷ (1 + (d ÷ 60 km)²): se reduce a la mitad hacia los 60 km, sin un corte brusco.",
          },
          {
            name: "Antigüedad (solo catálogo histórico)",
            detail: "Se multiplica por e^(−edad ÷ 40 años). Los eventos en vivo no se atenúan porque ya son recientes.",
          },
          {
            name: "Compresión a 0–1",
            detail:
              "Se suma la influencia de todos los eventos y se aplica 1 − e^(−suma ÷ 1700). Como referencia: un M4 lejano da cerca de 0,02, un M5 a 50 km cerca de 0,1, un M6 a menos de 30 km cerca de 0,4 y un M7 o mayor a menos de 10 km supera 0,85.",
          },
        ],
      },
      {
        title: "Niveles de exposición",
        bullets: [SCALE_5.replace("Medio", "Moderado")],
      },
    ],
    limitations: [
      "La exposición mide cercanía a la actividad sísmica, no el daño esperado: no considera tipo de suelo ni calidad de las construcciones.",
      "Los catálogos tienen distinta densidad: el SGC detecta sismos menores que USGS no ve.",
      "La lista de los últimos sismos solo incluye eventos con magnitud mínima de 2,5.",
    ],
  },

  hidrantes: {
    summary:
      "Inventario estático de hidrantes del casco urbano de Sevilla. No hay modelo de amenaza: es una consulta de ubicación para saber cuál es el más cercano.",
    sources: ["Archivo GeoJSON del inventario (public/data/hidrantes/hidrantes-sevilla.geojson), exportado desde cartografía CAD"],
    flow: [
      "El inventario se carga como un archivo estático, sin consulta a un servicio externo.",
      "El punto de referencia es la ubicación del usuario (geolocalización) o el sitio donde hace clic en el mapa.",
      "Los hidrantes se ordenan por cercanía a ese punto.",
      "Al elegir uno, se pide una ruta por calles al servicio de ruteo OSRM.",
      "Si OSRM no responde, se dibuja una línea recta y se indica que no sigue las calles.",
    ],
    sections: [
      {
        title: "Qué se muestra",
        bullets: [
          "El mapa dibuja como máximo 60 puntos a la vez. El resto está disponible con el botón Ver todas.",
          "La capa es exclusiva: no se puede apilar con otras capas.",
        ],
      },
      {
        title: "Qué dice cada punto",
        intro:
          "El archivo proviene de bloques de AutoCAD y solo trae la ubicación y metadatos del dibujo (capa HIDRANTES). No incluye identificación, tipo, caudal ni estado operativo.",
      },
    ],
    limitations: [
      "No se sabe si un hidrante está operativo ni su caudal.",
      "El archivo puede incluir puntos duplicados con la misma coordenada, producto de la exportación CAD.",
      "Cubre solo el casco urbano de Sevilla, no las demás municipalidades ni zonas rurales.",
      "La ruta usa OSRM público, que no conoce cierres de vía ni tráfico.",
    ],
  },
}
