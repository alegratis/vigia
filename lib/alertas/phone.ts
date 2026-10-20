/**
 * Normaliza un celular colombiano a E.164. Acepta "3001234567", "300 123 4567",
 * "+57 300 123 4567" o "57300...". Los celulares colombianos son 10 dígitos y
 * empiezan por 3. Devuelve null si no es un celular válido.
 */
export function normalizeColombianMobile(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  const national = digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits
  if (!/^3\d{9}$/.test(national)) return null
  return `+57${national}`
}

/** Números E.164 de otros países autorizados solo para pruebas (ALERTAS_TEST_PHONES, separados por coma). */
function testPhoneAllowlist(): Set<string> {
  const raw = process.env.ALERTAS_TEST_PHONES ?? ''
  return new Set(
    raw
      .split(',')
      .map((p) => `+${p.replace(/\D/g, '')}`)
      .filter((p) => /^\+[1-9]\d{7,14}$/.test(p)),
  )
}

/**
 * Celular colombiano, o un número internacional escrito con "+" que esté en la
 * lista de pruebas. Cualquier otro número se rechaza.
 */
export function normalizeSubscriberPhone(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed.startsWith('+') && !/^\+\s*57/.test(trimmed)) {
    const e164 = `+${trimmed.replace(/\D/g, '')}`
    return testPhoneAllowlist().has(e164) ? e164 : null
  }
  return normalizeColombianMobile(trimmed)
}

/** Muestra el número sin exponerlo completo: +57 300 *** 4567. */
export function maskPhone(e164: string): string {
  if (/^\+57\d{10}$/.test(e164)) {
    const n = e164.slice(3)
    return `+57 ${n.slice(0, 3)} *** ${n.slice(6)}`
  }
  if (/^\+[1-9]\d{7,14}$/.test(e164)) return `${e164.slice(0, 2)} *** ${e164.slice(-4)}`
  return '***'
}
