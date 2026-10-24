import "server-only"
import { getRiesgoCompuestoVeredas } from "@/lib/riesgo-compuesto/server"
import type { CompoundFeature } from "@/lib/riesgo-compuesto/api-types"

/** Forma pública y estable del riesgo de una vereda. No depende de los tipos internos del mapa. */
export interface RiesgoVeredaV1 {
  codigoVereda: string
  nombre: string
  municipio: string
  esCascoUrbano: boolean
  /** Muy bajo | Bajo | Moderado | Alto | Muy alto. `null` si ninguna amenaza se pudo calcular. */
  nivel: string | null
  /** Puntaje compuesto de 0 a 1 (mayor = peor). */
  puntaje: number | null
  /** Informar | Prepararse | Actuar, según el vocabulario del IDEAM. */
  accion: string | null
  amenazaDominante: string | null
  amenazas: {
    amenaza: string
    etiqueta: string
    nivel: string | null
    puntaje: number | null
    detalle: string | null
  }[]
  poblacion: { total: number | null; menores5: number | null; mayores60: number | null }
  infraestructura: {
    escuelas: number | null
    hospitales: number | null
    farmacias: number | null
    criticas: number | null
    sitiosCriticos: number
  }
  resumen: string
}

export function shapeRiesgo(feature: CompoundFeature): RiesgoVeredaV1 {
  const p = feature.properties
  return {
    codigoVereda: p.codigoVereda,
    nombre: p.nombre,
    municipio: p.municipio,
    esCascoUrbano: p.esCascoUrbano ?? false,
    nivel: p.compoundLevel,
    puntaje: p.compoundScore,
    accion: p.actionTier,
    amenazaDominante: p.dominantHazard,
    amenazas: p.subHazards.map((s) => ({
      amenaza: s.hazard,
      etiqueta: s.label,
      nivel: s.rawLevel,
      puntaje: s.normalizedScore,
      detalle: s.detail,
    })),
    poblacion: { total: p.poblacion, menores5: p.poblacionMenores5, mayores60: p.poblacionMayores60 },
    infraestructura: {
      escuelas: p.escuelas,
      hospitales: p.hospitales,
      farmacias: p.farmacias,
      criticas: p.infraestructuraCritica,
      sitiosCriticos: p.sitiosCriticos,
    },
    resumen: p.narrative.resumen,
  }
}

export async function getRiesgoFeatures(): Promise<CompoundFeature[]> {
  const collection = await getRiesgoCompuestoVeredas()
  return collection.features
}
