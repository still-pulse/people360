import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { coverImagePlacement, renderBadgePdf } from './pdf'
import type { BadgeSnapshot } from './types'

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const data: BadgeSnapshot = { employeeId: '00009742', fullName: 'Jackeline Carter', firstName: 'Jackeline', lastName: 'Carter', role: 'Coord. de Contratos', department: 'Administrativo', admissionDate: '03/07/2024', document: 'OAB/SP 492.503', photoId: 'photo', photoFocusY: 18 }

describe('PDF do crachá', () => {
  it('gera frente e verso com MediaBox físico de 54 x 86 mm', async () => {
    const bytes = renderBadgePdf(data, onePixelPng, 'image/png')
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(2)
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(153.07, 1)
      expect(page.getHeight()).toBeCloseTo(243.78, 1)
    }
  })

  it('acomoda nome, cargo, setor e documento longos sem alterar o tamanho físico', async () => {
    const bytes = renderBadgePdf({
      ...data,
      firstName: 'Anna Carolina', lastName: 'Bittencourt Cavalcanti Figueiredo',
      fullName: 'Anna Carolina Bittencourt Cavalcanti Figueiredo de Oliveira Santos',
      role: 'Supervisora Administrativa de Faturamento, Convênios e Contratos',
      department: 'Faturamento, Convênios e Contratos', document: 'COREN-SP 1234567',
    }, onePixelPng, 'image/png')
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(2)
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(153.07, 1)
  })

  it('aplica cover sem distorcer fotos verticais e horizontais', () => {
    const vertical = coverImagePlacement(492, 740, 30.6, 35.125, 18)
    const horizontal = coverImagePlacement(740, 492, 30.6, 35.125, 50)
    expect(vertical.width / vertical.height).toBeCloseTo(492 / 740, 6)
    expect(horizontal.width / horizontal.height).toBeCloseTo(740 / 492, 6)
    expect(vertical.width).toBeGreaterThanOrEqual(30.6)
    expect(vertical.height).toBeGreaterThanOrEqual(35.125)
    expect(horizontal.width).toBeGreaterThanOrEqual(30.6)
    expect(horizontal.height).toBeGreaterThanOrEqual(35.125)
  })
})
