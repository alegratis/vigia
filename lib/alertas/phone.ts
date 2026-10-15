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

/** Muestra el número sin exponerlo completo: +57 300 *** 4567. */
export function maskPhone(e164: string): string {
  if (!/^\+57\d{10}$/.test(e164)) return '***'
  const n = e164.slice(3)
  return `+57 ${n.slice(0, 3)} *** ${n.slice(6)}`
}
