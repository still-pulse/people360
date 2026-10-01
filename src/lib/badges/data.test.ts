import { describe, expect, it } from 'vitest'
import { badgeFileName, splitBadgeName, snapshotNeedsUpdate, validateBadgeSnapshot } from './data'
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
  it('preserva zeros da matrícula', () => expect(base.employeeId).toBe('00009742'))
  it('gera filename sem acentos', () => expect(badgeFileName('João da Silva')).toBe('Cracha-Joao-da-Silva.pdf'))
  it('bloqueia emissão sem foto', () => expect(validateBadgeSnapshot({ ...base, photoId: '' })).toContain('foto para o crachá'))
  it('detecta somente divergências relevantes', () => {
    expect(snapshotNeedsUpdate(base, { ...base })).toBe(false)
    expect(snapshotNeedsUpdate({ ...base, role: 'Gerente' }, base)).toBe(true)
  })
})
