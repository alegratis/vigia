/**
 * Deterministic Spanish recommendations for the compound risk report —
 * fixed templates keyed by IDEAM's Informar/Prepararse/Actuar tier and the
 * dominant hazard, never free-text generated. Client-safe (no server imports).
 */

import type { IdeamActionTier } from "./levels"
import type { HazardName } from "./api-types"

export interface CompoundRecommendations {
  /** What the tier means for this vereda, in one sentence. */
  tierSummary: string
  /** General steps that apply at this tier whatever the hazard. */
  general: string[]
  /** Hazard-specific steps for the dominant hazard, empty when none is dominant. */
  hazard: string[]
}

const TIER_SUMMARY: Record<IdeamActionTier, string> = {
  Informar: "El riesgo es bajo: basta con mantenerse informado y conservar las medidas básicas de prevención.",
  Prepararse: "El riesgo es moderado: conviene revisar y ajustar los planes de emergencia antes de que la situación empeore.",
  Actuar: "El riesgo es alto: se recomienda activar los planes de respuesta y seguir las indicaciones de las autoridades.",
}

const TIER_GENERAL: Record<IdeamActionTier, string[]> = {
  Informar: [
    "Consulta con regularidad los boletines oficiales de IDEAM, el Servicio Geológico Colombiano y la gestión del riesgo municipal.",
    "Verifica que los números de emergencia y los canales de aviso de la comunidad estén actualizados.",
  ],
  Prepararse: [
    "Revisa el plan de emergencia familiar y comunitario: rutas de evacuación, puntos de encuentro y responsables.",
    "Alista un kit de emergencia con agua, alimentos no perecederos, linterna, radio, botiquín y documentos.",
    "Sigue los boletines oficiales a diario y coordina con la gestión del riesgo municipal.",
  ],
  Actuar: [
    "Atiende de inmediato las instrucciones de la gestión del riesgo municipal y de los organismos de socorro.",
    "Ten listo el kit de emergencia y prepárate para evacuar hacia el punto de encuentro más cercano.",
    "Evita las zonas expuestas y presta especial atención a niños, adultos mayores y personas con movilidad reducida.",
    "Mantén comunicación con vecinos y autoridades y reporta cualquier cambio en las condiciones del terreno o los cauces.",
  ],
}

const HAZARD_STEPS: Record<HazardName, string[]> = {
  deslizamientos: [
    "Vigila grietas, inclinación de árboles o postes y cambios en el terreno de las laderas.",
    "Evita transitar o permanecer bajo taludes y laderas durante y después de lluvias intensas.",
  ],
  inundaciones: [
    "Mantente alejado de quebradas y ríos cuando suba el nivel del agua y no cruces corrientes crecidas.",
    "Identifica con antelación las zonas altas más cercanas para refugiarte.",
  ],
  incendios: [
    "Evita quemas y fuentes de ignición cerca de la vegetación seca.",
    "Mantén despejado el material combustible alrededor de las viviendas y reporta cualquier foco al cuerpo de bomberos.",
  ],
  precipitacion: [
    "Atiende los avisos de lluvias intensas y limpia canales, desagües y alcantarillas cercanas.",
    "Evita desplazamientos innecesarios durante los picos de lluvia.",
  ],
  sismologia: [
    "Identifica zonas seguras dentro de la vivienda y asegura muebles y objetos pesados.",
    "Ten claro el procedimiento durante un sismo: agacharse, cubrirse y sujetarse, y evacuar solo cuando sea seguro.",
  ],
}

export function buildRecommendations(
  actionTier: IdeamActionTier,
  dominantHazard: HazardName | null,
): CompoundRecommendations {
  return {
    tierSummary: TIER_SUMMARY[actionTier],
    general: TIER_GENERAL[actionTier],
    hazard: dominantHazard ? HAZARD_STEPS[dominantHazard] : [],
  }
}
