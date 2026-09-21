export function onlyDigits(value: unknown, maxLength = Number.POSITIVE_INFINITY) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLength)
}

export function formatCpf(value: unknown) {
  const digits = onlyDigits(value, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function formatPhone(value: unknown) {
  const digits = onlyDigits(value, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatCep(value: unknown) {
  const digits = onlyDigits(value, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function formatPis(value: unknown) {
  const digits = onlyDigits(value, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 8) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 10) return `${digits.slice(0, 3)}.${digits.slice(3, 8)}.${digits.slice(8)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 8)}.${digits.slice(8, 10)}-${digits.slice(10)}`
}

export function formatRg(value: unknown) {
  const clean = String(value ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 9)
  if (clean.length <= 2) return clean
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}-${clean.slice(8)}`
}

export function formatAgency(value: unknown) {
  return onlyDigits(value, 6)
}

export function formatAccount(value: unknown) {
  return onlyDigits(value, 14)
}

export function formatAccountDigit(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 2)
}
