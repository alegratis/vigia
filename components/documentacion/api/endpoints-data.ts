export const API_BASE_URL = "https://vigia.redlabot.org"

export interface ApiParam {
  name: string
  location: "ruta" | "query"
  type: string
  description: string
  defaultValue?: string
  required?: boolean
}

export interface ApiEndpoint {
  path: string
  summary: string
  description?: string
  params: ApiParam[]
  example: string
  responseLabel: string
  response: string
  freshness: string
  errors: string[]
}

export interface ApiGroup {
  id: string
  title: string
  intro: string
  endpoints: ApiEndpoint[]
}

const ATRIBUCION = "Vigía (RED LabOT). Datos derivados de IDEAM, SGC, USGS…"

export const API_GROUPS: ApiGroup[] = [
  {
    id: "veredas",
    title: "Veredas",
    intro:
      "Catálogo de las veredas y cascos urbanos que cubre Vigía. Sirve para obtener los códigos que luego se usan en el resto de la API.",
    endpoints: [
      {
        path: "/api/v1/veredas",
        summary: "Listado de veredas",
        description:
          "Devuelve cada vereda con su caja envolvente (bbox) y su centro. Los cascos urbanos se marcan con esCascoUrbano.",
        params: [
          {
            name: "municipio",
            location: "query",
            type: "texto",
            description: "Filtra por municipio. No distingue mayúsculas ni tildes.",
          },
        ],
        example: `curl "${API_BASE_URL}/api/v1/veredas?municipio=Zarzal"`,
        responseLabel: "Respuesta (recortada a un elemento de 19)",
        response: `{
  "data": [
    {
      "codigoVereda": "76895-urbano",
      "nombre": "Casco Urbano",
      "municipio": "Zarzal",
      "esCascoUrbano": true,
      "bbox": { "sur": 4.3712, "oeste": -76.0819, "norte": 4.4081, "este": -76.0592 },
      "centro": { "lat": 4.3897, "lon": -76.0705 }
    }
  ],
  "meta": {
    "generadoEn": "2026-10-24T18:27:49.010Z",
    "atribucion": "${ATRIBUCION}",
    "total": 19
  }
}`,
        freshness: "24 horas",
        errors: ["502 upstream_error: no se pudo consultar el listado."],
      },
      {
        path: "/api/v1/veredas/{codigoVereda}",
        summary: "Riesgo compuesto de una vereda",
        description:
          "Devuelve el riesgo compuesto de una sola vereda, con el detalle por amenaza, población e infraestructura. El código sale del listado anterior.",
        params: [
          {
            name: "codigoVereda",
            location: "ruta",
            type: "texto",
            required: true,
            description: "Código de la vereda, por ejemplo 76895011 o 76895-urbano.",
          },
          {
            name: "geometria",
            location: "query",
            type: "booleano",
            defaultValue: "false",
            description: "Con true, añade el polígono de la vereda en data.geometria (GeoJSON).",
          },
        ],
        example: `curl "${API_BASE_URL}/api/v1/veredas/76895011"`,
        responseLabel: "Respuesta (amenazas recortadas a dos de cinco)",
        response: `{
  "data": {
    "codigoVereda": "76895011",
    "nombre": "Sin Definir",
    "municipio": "Zarzal",
    "esCascoUrbano": false,
    "nivel": "Muy alto",
    "puntaje": 0.4656,
    "accion": "Actuar",
    "amenazaDominante": "sismologia",
    "amenazas": [
      {
        "amenaza": "inundaciones",
        "etiqueta": "Inundaciones",
        "nivel": "Muy alta",
        "puntaje": 0.8937,
        "detalle": "Quebrada más cercana: 0.12 km"
      },
      {
        "amenaza": "sismologia",
        "etiqueta": "Sismología",
        "nivel": "Muy alto",
        "puntaje": 0.941,
        "detalle": "Evento más cercano: 7.6 km (M 2.2)"
      }
    ],
    "poblacion": { "total": null, "menores5": null, "mayores60": null },
    "infraestructura": {
      "escuelas": null,
      "hospitales": null,
      "farmacias": null,
      "criticas": null,
      "sitiosCriticos": 0
    },
    "resumen": "Sin Definir (Zarzal) tiene un riesgo compuesto muy alto…"
  },
  "meta": { "generadoEn": "2026-10-24T18:27:59.115Z", "atribucion": "${ATRIBUCION}" }
}`,
        freshness: "10 minutos",
        errors: [
          "404 not_found: no existe una vereda con ese código.",
          "502 upstream_error: no se pudo calcular el riesgo.",
        ],
      },
    ],
  },
  {
    id: "riesgo",
    title: "Riesgo compuesto",
    intro:
      "El riesgo de todas las veredas en una sola llamada, pensado para tableros, mapas y análisis en lote.",
    endpoints: [
      {
        path: "/api/v1/riesgo",
        summary: "Riesgo de todas las veredas",
        description:
          "Cada elemento tiene la misma forma que el riesgo de una vereda. Con formato=geojson, data es una FeatureCollection y cada Feature lleva esos campos en properties y el polígono en geometry.",
        params: [
          {
            name: "municipio",
            location: "query",
            type: "texto",
            description: "Filtra por municipio. No distingue mayúsculas ni tildes.",
          },
          {
            name: "accion",
            location: "query",
            type: "informar | prepararse | actuar",
            description:
              "Devuelve las veredas con esa acción o una más grave. Con prepararse se obtienen las veredas en Prepararse y en Actuar.",
          },
          {
            name: "formato",
            location: "query",
            type: "json | geojson",
            defaultValue: "json",
            description: "Forma de data: lista de objetos o FeatureCollection.",
          },
        ],
        example: `curl "${API_BASE_URL}/api/v1/riesgo?municipio=Zarzal&accion=prepararse&formato=geojson"`,
        responseLabel: "Respuesta con formato=geojson (recortada)",
        response: `{
  "data": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "id": "76895011",
        "properties": {
          "codigoVereda": "76895011",
          "nombre": "Sin Definir",
          "municipio": "Zarzal",
          "nivel": "Muy alto",
          "puntaje": 0.4656,
          "accion": "Actuar",
          "amenazaDominante": "sismologia"
        },
        "geometry": { "type": "MultiPolygon", "coordinates": [ … ] }
      }
    ]
  },
  "meta": {
    "generadoEn": "2026-10-24T18:27:59.115Z",
    "atribucion": "${ATRIBUCION}",
    "total": 19
  }
}`,
        freshness: "10 minutos",
        errors: [
          "400 invalid_parameter: accion no es informar, prepararse ni actuar, o formato no es json ni geojson.",
          "502 upstream_error: no se pudo calcular el riesgo compuesto.",
        ],
      },
    ],
  },
  {
    id: "alertas",
    title: "Alertas",
    intro:
      "Las alertas que Vigía emitió en las últimas 72 horas. Son las mismas que reciben los suscriptores, pero la API nunca expone datos de ellos.",
    endpoints: [
      {
        path: "/api/v1/alertas",
        summary: "Alertas emitidas en las últimas 72 horas",
        description:
          "Una lista vacía es lo normal cuando no hay nada que avisar. Solo existen dos niveles de alerta: prepararse y actuar.",
        params: [
          {
            name: "amenaza",
            location: "query",
            type: "deslizamientos | inundaciones | incendios | sismos",
            description: "Filtra por tipo de amenaza.",
          },
        ],
        example: `curl "${API_BASE_URL}/api/v1/alertas?amenaza=sismos"`,
        responseLabel: "Respuesta (ejemplo ilustrativo: al escribir esto no había alertas activas)",
        response: `{
  "data": [
    {
      "id": "5b0f3c1e-8a27-4d6e-9c41-2f7a6d9e0b13",
      "amenaza": "sismos",
      "nivel": "prepararse",
      "zona": "Zarzal",
      "fecha": "2026-10-24T17:49:00.000Z",
      "magnitud": 4.8
    }
  ],
  "meta": {
    "generadoEn": "2026-10-24T18:27:49.774Z",
    "atribucion": "${ATRIBUCION}",
    "total": 1,
    "ventanaHoras": 72
  }
}`,
        freshness: "1 minuto",
        errors: [
          "400 invalid_parameter: amenaza no es una de las cuatro permitidas.",
          "502 upstream_error: no se pudo leer el historial de alertas.",
        ],
      },
    ],
  },
  {
    id: "sismos",
    title: "Sismos",
    intro:
      "Sismos recientes en el área de Vigía. Une el catálogo del Servicio Geológico Colombiano (SGC) y el de USGS, y cuando ambos reportan el mismo evento conserva el de SGC.",
    endpoints: [
      {
        path: "/api/v1/sismos",
        summary: "Sismos recientes",
        description:
          "Ordenados del más reciente al más antiguo. meta.areaConsultada indica la caja geográfica que se consulta.",
        params: [
          {
            name: "minMagnitud",
            location: "query",
            type: "número, 0 a 10",
            defaultValue: "0",
            description: "Magnitud mínima.",
          },
          {
            name: "dias",
            location: "query",
            type: "entero, 1 a 30",
            defaultValue: "7",
            description: "Cuántos días hacia atrás.",
          },
          {
            name: "limite",
            location: "query",
            type: "entero, 1 a 200",
            defaultValue: "50",
            description: "Máximo de sismos devueltos.",
          },
        ],
        example: `curl "${API_BASE_URL}/api/v1/sismos?minMagnitud=3&dias=14&limite=10"`,
        responseLabel: "Respuesta",
        response: `{
  "data": [
    {
      "id": "sgc-live-SGC2026uysjui",
      "fuente": "SGC",
      "fecha": "2026-10-24T17:49:00.000Z",
      "magnitud": 2.5,
      "profundidadKm": 8,
      "lat": 3.826,
      "lon": -75.6508,
      "lugar": "Chaparral - Tolima, Colombia",
      "revision": "manual"
    }
  ],
  "meta": {
    "generadoEn": "2026-10-24T18:27:49.010Z",
    "atribucion": "${ATRIBUCION}",
    "total": 1,
    "areaConsultada": { "sur": 3.4, "oeste": -76.6, "norte": 5.2, "este": -75.2 }
  }
}`,
        freshness: "2 minutos",
        errors: [
          "400 invalid_parameter: minMagnitud, dias o limite fuera de rango o no numéricos.",
          "502 upstream_error: no se pudo consultar el catálogo sísmico.",
        ],
      },
    ],
  },
]
