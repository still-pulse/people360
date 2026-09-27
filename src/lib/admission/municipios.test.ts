import { describe, expect, it } from 'vitest'
import { fromErpnextMunicipio, toErpnextMunicipio } from './municipios'

describe('conversão de municípios IBGE ↔ ERPNext', () => {
  it('converte o padrão do portal para o doctype Municipios', () => {
    expect(toErpnextMunicipio('Osasco - SP')).toBe('São Paulo - Osasco')
    expect(toErpnextMunicipio("Alta Floresta D'Oeste - RO")).toBe("Rondônia - Alta Floresta D'Oeste")
    expect(toErpnextMunicipio('Brasília - DF')).toBe('Distrito Federal - Brasília')
  })
  it('converte o valor do ERPNext para a lista do portal', () => {
    expect(fromErpnextMunicipio('São Paulo - Osasco')).toBe('Osasco - SP')
    expect(fromErpnextMunicipio('Mato Grosso do Sul - Campo Grande')).toBe('Campo Grande - MS')
  })
  it('mantém valores que já estão no formato de destino ou fora do padrão', () => {
    expect(toErpnextMunicipio('São Paulo - Osasco')).toBe('São Paulo - Osasco')
    expect(fromErpnextMunicipio('Osasco - SP')).toBe('Osasco - SP')
    expect(toErpnextMunicipio('')).toBe('')
    expect(fromErpnextMunicipio(null)).toBe('')
  })
})
