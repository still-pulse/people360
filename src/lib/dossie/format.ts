// Formatação pt-BR compartilhada entre API, telas e PDFs do dossiê.

/** Datas de calendário (admissão, nascimento, vigência) ficam em UTC à meia-noite. */
export function fmtDate(value?: Date | string | null): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function fmtDateTime(value?: Date | string | null): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
  return parts.replace(',', ' às')
}

export function fmtLongDate(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'long' }).format(value)
}

export function fmtMoney(value?: number | string | null): string {
  if (value == null || value === '') return '—'
  const raw = String(value).trim()
  // "1.234,56" (pt-BR) usa vírgula decimal; "3321.87" (valor técnico) já está em ponto decimal.
  const number = typeof value === 'number' ? value : Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw)
  if (!Number.isFinite(number)) return String(value)
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtCpf(value?: string | null): string {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length === 11 ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}` : (value || '—')
}

/** "AAAA-MM-DD" (ou ISO completo) → Date em UTC/meia-noite; devolve null se inválida. */
export function parseDateInput(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isNaN(date.getTime()) ? null : date
}

export function toDateInput(value?: Date | string | null): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** Nome de arquivo seguro: sem acentos, maiúsculo, apenas letras/números/_ . - */
export function fileSlug(value: string, fallback = 'ARQUIVO'): string {
  const slug = value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase().slice(0, 80)
  return slug || fallback
}

export function isoDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date)
}
