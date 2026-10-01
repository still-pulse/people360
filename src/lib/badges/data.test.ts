import { describe, expect, it } from 'vitest'
import { badgeBackName, badgeDepartmentLines, badgeFileName, printableBadgeDocument, splitBadgeName, snapshotNeedsUpdate, validateBadgeSnapshot } from './data'
import type { BadgeSnapshot } from './types'

const base: BadgeSnapshot = {
  employeeId: '00009742', fullName: 'Jackeline Carter', firstName: 'Jackeline', lastName: 'Carter',
  role: 'Coord. de Contratos', department: 'Administrativo', admissionDate: '03/07/2024',
  document: 'OAB/SP 492.503', photoId: 'photo-1', photoFocusY: 18,
}

describe('dados do crachá', () => {
  it('separa nome comum', () => expect(splitBadgeName('Jackeline Carter')).toEqual({ firstName: 'Jackeline', lastName: 'Carter' }))
  it('preserva primeiro nome composto e último sobrenome', () => expect(splitBadgeName('Maria Eduarda de Souza Oliveira')).toEqual({ firstName: 'Maria Eduarda', lastName: 'Oliveira' }))
  it('trata nomes longos com partículas', () => expect(splitBadgeName('Anna Carolina Bittencourt Cavalcanti Figueiredo de Oliveira Santos')).toEqual({ firstName: 'Anna Carolina', lastName: 'Santos' }))
  it('usa apenas primeiro e último nome no verso', () => expect(badgeBackName('ANGELICA CRISTINA DE ALMEIDA')).toBe('ANGELICA ALMEIDA'))
  it('separa setor e unidade em linhas distintas', () => expect(badgeDepartmentLines('RH - Recursos Humanos - UPA Cumbica')).toEqual(['RH - Recursos Humanos', 'UPA Cumbica']))
  it('omite CPF e RG, mas mantém registro profissional', () => {
    expect(printableBadgeDocument('CPF: 422.230.158-24')).toBe('')
    expect(printableBadgeDocument('RG 12.345.678-9')).toBe('')
    expect(printableBadgeDocument('422.230.158-24')).toBe('')
    expect(printableBadgeDocument('12.345.678-9')).toBe('')
    expect(printableBadgeDocument('COREN-SP 1234567')).toBe('COREN-SP 1234567')
  })
  it('preserva zeros da matrícula', () => expect(base.employeeId).toBe('00009742'))
  it('gera filename sem acentos', () => expect(badgeFileName('João da Silva')).toBe('Cracha-Joao-da-Silva.pdf'))
  it('bloqueia emissão sem foto', () => expect(validateBadgeSnapshot({ ...base, photoId: '' })).toContain('foto para o crachá'))
  it('permite emissão sem documento', () => expect(validateBadgeSnapshot({ ...base, document: '' })).not.toContain('documento'))
  it('detecta somente divergências relevantes', () => {
    expect(snapshotNeedsUpdate(base, { ...base })).toBe(false)
    expect(snapshotNeedsUpdate({ ...base, role: 'Gerente' }, base)).toBe(true)
    expect(snapshotNeedsUpdate({ ...base, document: '' }, base)).toBe(false)
    expect(snapshotNeedsUpdate({ ...base, document: '' }, { ...base, document: 'CPF: 422.230.158-24' })).toBe(true)
  })
})
