export type DeliveryTone = 'ok' | 'neutral' | 'bad'

export interface DeliveryDescription {
  label: string
  hint: string
  tone: DeliveryTone
}

const STATUS: Record<string, DeliveryDescription> = {
  delivered: {
    label: 'Entregado',
    hint: 'La operadora confirmó que el mensaje llegó al teléfono.',
    tone: 'ok',
  },
  sent: {
    label: 'Enviado',
    hint: 'Twilio lo entregó a la operadora. Aún no hay confirmación de que llegó al teléfono.',
    tone: 'neutral',
  },
  queued: {
    label: 'En cola',
    hint: 'Se reservó el envío pero Twilio todavía no lo confirma.',
    tone: 'neutral',
  },
  accepted: { label: 'Aceptado', hint: 'Twilio aceptó el mensaje y lo va a enviar.', tone: 'neutral' },
  sending: { label: 'Enviando', hint: 'Twilio lo está enviando a la operadora.', tone: 'neutral' },
  undelivered: {
    label: 'No entregado',
    hint: 'La operadora no pudo entregarlo al teléfono.',
    tone: 'bad',
  },
  failed: { label: 'Fallido', hint: 'No se pudo enviar el mensaje.', tone: 'bad' },
  expected: {
    label: 'Habría recibido',
    hint: 'El evento se registró en modo sombra, así que no se envió ningún SMS.',
    tone: 'neutral',
  },
  pending: {
    label: 'Pendiente',
    hint: 'Evento en vivo sin envío registrado todavía. Puede estar en espera del siguiente ciclo, en horas de silencio o haber alcanzado un tope.',
    tone: 'neutral',
  },
}

export function describeDeliveryStatus(status: string): DeliveryDescription {
  return STATUS[status] ?? { label: status, hint: 'Estado reportado por Twilio.', tone: 'neutral' }
}

const ERRORS: Record<string, string> = {
  '21211': 'El número de destino no es válido.',
  '21408': 'La cuenta de Twilio no tiene habilitado el envío de SMS a ese país.',
  '21608': 'Cuenta de prueba de Twilio: el número de destino no está verificado.',
  '21610': 'El número respondió SALIR (STOP) y Twilio bloquea los envíos. Se marca la baja.',
  '21614': 'El número de destino no es un móvil que pueda recibir SMS.',
  '30003': 'Teléfono inalcanzable: apagado o sin cobertura.',
  '30004': 'El destinatario bloqueó los mensajes.',
  '30005': 'El número de destino es desconocido o ya no existe.',
  '30006': 'Línea fija o sin cobertura de la operadora.',
  '30007': 'La operadora filtró el mensaje (posible filtro de spam).',
  '30008': 'Error desconocido de la operadora.',
  '30034': 'Mensaje bloqueado: el número remitente no está registrado para este tipo de tráfico.',
}

export function describeErrorCode(code: string | null): string | null {
  if (!code) return null
  return ERRORS[code] ?? 'Código de error sin traducción. Búscalo en la documentación de errores de Twilio.'
}

export function maskPhone(e164: string): string {
  if (e164.length <= 7) return e164
  return `${e164.slice(0, 3)} ••• ${e164.slice(-4)}`
}
