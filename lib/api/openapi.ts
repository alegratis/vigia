import "server-only"

const meta = {
  type: "object",
  properties: {
    generadoEn: { type: "string", format: "date-time" },
    atribucion: { type: "string" },
    total: { type: "integer", description: "Número de elementos devueltos (solo en listados)." },
  },
}

function envelope(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    required: ["data", "meta"],
    properties: { data: dataSchema, meta: { $ref: "#/components/schemas/Meta" } },
  }
}

function jsonResponse(description: string, schema: Record<string, unknown>) {
  return { description, content: { "application/json": { schema } } }
}

const errorResponses = {
  "400": { $ref: "#/components/responses/ParametroInvalido" },
  "502": { $ref: "#/components/responses/ErrorUpstream" },
}

const nullableNumber = { type: "number", nullable: true }
const nullableInt = { type: "integer", nullable: true }
const nullableString = { type: "string", nullable: true }

export function buildOpenApiSpec(origin: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "API pública de Vigía",
      version: "1.0.0",
      description:
        "Datos de riesgo, alertas y sismos de Vigía (RED LabOT) para integrar otras aplicaciones sin replicar la lógica. Sin autenticación. Las respuestas se cachean en el borde, así que los datos pueden tener hasta unos minutos de antigüedad; revise `meta.generadoEn`. Vigía no es un sistema oficial de alerta: ante una emergencia llame al 123.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/v1/veredas": {
        get: {
          summary: "Listado de veredas",
          parameters: [
            { name: "municipio", in: "query", schema: { type: "string" }, description: "Filtra por municipio (sin distinguir tildes ni mayúsculas)." },
          ],
          responses: {
            "200": jsonResponse("Veredas con su caja envolvente y centro.", envelope({ type: "array", items: { $ref: "#/components/schemas/Vereda" } })),
            "502": errorResponses["502"],
          },
        },
      },
      "/api/v1/veredas/{codigoVereda}": {
        get: {
          summary: "Riesgo compuesto de una vereda",
          parameters: [
            { name: "codigoVereda", in: "path", required: true, schema: { type: "string" } },
            { name: "geometria", in: "query", schema: { type: "boolean" }, description: "Si es `true`, incluye el polígono de la vereda en `data.geometria`." },
          ],
          responses: {
            "200": jsonResponse("Riesgo de la vereda.", envelope({ $ref: "#/components/schemas/Riesgo" })),
            "404": { $ref: "#/components/responses/NoEncontrado" },
            "502": errorResponses["502"],
          },
        },
      },
      "/api/v1/riesgo": {
        get: {
          summary: "Riesgo compuesto de todas las veredas",
          description: "Con `formato=geojson`, `data` es una FeatureCollection que puede pasarse directamente como fuente GeoJSON a MapLibre o Leaflet; para un SIG como QGIS, extraiga primero `data` del sobre.",
          parameters: [
            { name: "municipio", in: "query", schema: { type: "string" } },
            { name: "accion", in: "query", schema: { type: "string", enum: ["informar", "prepararse", "actuar"] }, description: "Devuelve las veredas con esa acción o una más grave." },
            { name: "formato", in: "query", schema: { type: "string", enum: ["json", "geojson"], default: "json" } },
          ],
          responses: {
            "200": jsonResponse("Riesgo por vereda.", envelope({ type: "array", items: { $ref: "#/components/schemas/Riesgo" } })),
            ...errorResponses,
          },
        },
      },
      "/api/v1/alertas": {
        get: {
          summary: "Alertas emitidas en las últimas 72 horas",
          parameters: [
            { name: "amenaza", in: "query", schema: { type: "string", enum: ["deslizamientos", "inundaciones", "incendios", "sismos"] } },
          ],
          responses: {
            "200": jsonResponse("Alertas públicas. Nunca incluyen datos de suscriptores.", envelope({ type: "array", items: { $ref: "#/components/schemas/Alerta" } })),
            ...errorResponses,
          },
        },
      },
      "/api/v1/sismos": {
        get: {
          summary: "Sismos recientes en el área de Vigía",
          description: "Une SGC y USGS y elimina duplicados; SGC prevalece.",
          parameters: [
            { name: "minMagnitud", in: "query", schema: { type: "number", minimum: 0, maximum: 10, default: 0 } },
            { name: "dias", in: "query", schema: { type: "integer", minimum: 1, maximum: 30, default: 7 } },
            { name: "limite", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
          ],
          responses: {
            "200": jsonResponse("Sismos, del más reciente al más antiguo.", envelope({ type: "array", items: { $ref: "#/components/schemas/Sismo" } })),
            ...errorResponses,
          },
        },
      },
    },
    components: {
      schemas: {
        Meta: meta,
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: { code: { type: "string" }, message: { type: "string" } },
            },
          },
        },
        Vereda: {
          type: "object",
          properties: {
            codigoVereda: { type: "string" },
            nombre: { type: "string" },
            municipio: { type: "string" },
            esCascoUrbano: { type: "boolean" },
            bbox: {
              type: "object",
              properties: { sur: { type: "number" }, oeste: { type: "number" }, norte: { type: "number" }, este: { type: "number" } },
            },
            centro: { type: "object", properties: { lat: { type: "number" }, lon: { type: "number" } } },
          },
        },
        Riesgo: {
          type: "object",
          properties: {
            codigoVereda: { type: "string" },
            nombre: { type: "string" },
            municipio: { type: "string" },
            esCascoUrbano: { type: "boolean" },
            nivel: {
              ...nullableString,
              enum: ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto", null],
              description: "Lo fija la amenaza más grave (criterio OMM/GDACS), no el promedio: una sola amenaza severa no se diluye.",
            },
            puntaje: {
              ...nullableNumber,
              description: "Promedio ponderado de 0 a 1 para ordenar veredas dentro de un mismo nivel. No determina `nivel`, así que un nivel alto puede tener un puntaje bajo.",
            },
            accion: { ...nullableString, enum: ["Informar", "Prepararse", "Actuar", null] },
            amenazaDominante: nullableString,
            amenazas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  amenaza: { type: "string" },
                  etiqueta: { type: "string" },
                  nivel: { ...nullableString, description: "Nivel en la escala propia de cada amenaza; las etiquetas pueden variar entre amenazas (por ejemplo Baja o Bajo)." },
                  puntaje: nullableNumber,
                  detalle: nullableString,
                },
              },
            },
            poblacion: {
              type: "object",
              properties: { total: nullableInt, menores5: nullableInt, mayores60: nullableInt },
            },
            infraestructura: {
              type: "object",
              properties: {
                escuelas: nullableInt,
                hospitales: nullableInt,
                farmacias: nullableInt,
                criticas: nullableInt,
                sitiosCriticos: { type: "integer" },
              },
            },
            resumen: { type: "string" },
          },
        },
        Alerta: {
          type: "object",
          properties: {
            id: { type: "string" },
            amenaza: { type: "string", enum: ["deslizamientos", "inundaciones", "incendios", "sismos"] },
            nivel: { type: "string", enum: ["prepararse", "actuar"] },
            zona: { type: "string" },
            fecha: { type: "string", format: "date-time" },
            magnitud: nullableNumber,
          },
        },
        Sismo: {
          type: "object",
          properties: {
            id: { type: "string" },
            fuente: { type: "string", enum: ["SGC", "USGS"] },
            fecha: { type: "string", format: "date-time" },
            magnitud: { type: "number" },
            profundidadKm: nullableNumber,
            lat: { type: "number" },
            lon: { type: "number" },
            lugar: nullableString,
            revision: { ...nullableString, description: "SGC: manual (revisado por analista) o automatic." },
          },
        },
      },
      responses: {
        ParametroInvalido: { description: "Parámetro inválido.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        NoEncontrado: { description: "Recurso no encontrado.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        ErrorUpstream: { description: "Falló una fuente de datos.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      },
    },
  }
}
