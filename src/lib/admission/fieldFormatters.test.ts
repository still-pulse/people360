import { describe, expect, it } from 'vitest'
import { formatAccount, formatAccountDigit, formatAgency, formatCep, formatCpf, formatPhone, formatPis, formatRg } from './fieldFormatters'

describe('admission field formatters', () => {
  it('formats Brazilian personal identifiers and contact fields', () => {
    expect(formatCpf('42258822840')).toBe('422.588.228-40')
    expect(formatRg('49312083x')).toBe('49.312.083-X')
    expect(formatPhone('11953343199')).toBe('(11) 95334-3199')
    expect(formatPis('12345678901')).toBe('123.45678.90-1')
  })

  it('formats address and bank fields without accepting arbitrary characters', () => {
    expect(formatCep('02531-010')).toBe('02531-010')
    expect(formatAgency('01a2-3')).toBe('0123')
    expect(formatAccount('12.345-6')).toBe('123456')
    expect(formatAccountDigit('7-x')).toBe('7X')
  })
})
