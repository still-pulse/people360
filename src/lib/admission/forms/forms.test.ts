import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildFormContext, dmy, employerForUnit, experiencePeriods, longDate, saoPauloDay, scheduleText, splitCity } from './context'
import { reaisPorExtenso } from './extenso'
import { ADMISSION_LAYOUTS } from '.'
import { missingPcdAnswers } from '../pcd'

const admission = {
  protocol: 'ADM-1', candidateName: 'Maria Souza', unitId: 'u1', jobTitle: 'Enfermeiro', department: 'Enfermagem', salary: 3886.36,
  workSchedule: '07h00 às 19h00', breakSchedule: '12h00 às 13h00', hireDate: new Date('2026-08-24T00:00:00Z'), experienceDays: 90,
  unit: { name: 'GRU - UPA São João' },
  dependents: [{ name: 'Eloá', birthDate: new Date('2021-11-18T00:00:00Z'), relationship: 'Filho(a) ou enteado(a) até 21 anos', irrfDependent: true, childUnder14: true }],
  transport: { requested: true, routes: [{ type: 'Ônibus', line: '257', outbound: 5.5, returnValue: 5.5 }] },
}

describe('formulários oficiais da admissão', () => {
  it('escreve o salário por extenso como no relatório admissional', () => {
    expect(reaisPorExtenso(4000)).toBe('QUATRO MIL REAIS')
    expect(reaisPorExtenso(2720.45)).toBe('DOIS MIL SETECENTOS E VINTE REAIS E QUARENTA E CINCO CENTAVOS')
    expect(reaisPorExtenso(3886.36)).toBe('TRÊS MIL OITOCENTOS E OITENTA E SEIS REAIS E TRINTA E SEIS CENTAVOS')
    expect(reaisPorExtenso(1200)).toBe('MIL E DUZENTOS REAIS')
    expect(reaisPorExtenso(100)).toBe('CEM REAIS')
    expect(reaisPorExtenso(1)).toBe('UM REAL')
  })

  it('calcula o contrato de experiência 45 + 45 dias como no exemplo', () => {
    const periods = experiencePeriods(new Date('2026-08-24T00:00:00Z'), 90)
    expect(dmy(periods.firstEnd)).toBe('07/10/2026')
    expect(dmy(periods.totalEnd)).toBe('21/11/2026')
    expect(periods.extension).toBe(45)
    expect(experiencePeriods(new Date('2026-08-24T00:00:00Z'), 30)).toMatchObject({ first: 30, extension: 0, totalEnd: null })
  })

  it('formata datas, horários e cidade', () => {
    expect(longDate(new Date('2026-08-24T00:00:00Z'))).toBe('24 de Agosto de 2026')
    expect(scheduleText('19h00 às 07h00')).toBe('19:00 às 07:00')
    expect(splitCity('Iaçu - BA')).toEqual({ city: 'Iaçu', uf: 'BA' })
    expect(dmy('1992-08-12')).toBe('12/08/1992')
    // 23h em São Paulo já é o dia seguinte em UTC: a data do documento é a de São Paulo.
    expect(dmy(saoPauloDay(new Date('2026-09-29T02:30:00Z')))).toBe('28/09/2026')
  })

  it('usa o empregador configurado para a unidade e o padrão nas demais', () => {
    process.env.ADMISSION_EMPLOYERS_BY_UNIT = JSON.stringify({ u2: { nome: 'Filial Osasco', cnpj: '50.351.626/0099-00', cidade: 'Osasco' } })
    expect(employerForUnit('u2')).toMatchObject({ nome: 'FILIAL OSASCO', cnpj: '50.351.626/0099-00', cidade: 'OSASCO', uf: 'SP' })
    expect(employerForUnit('u1')).toMatchObject({ nome: 'BENEFICENCIA HOSPITALAR DE CESARIO LANGE', cnpj: '50.351.626/0001-10', logradouro: 'AVENIDA SÃO PAULO, 340', bairro: 'VILA BRASIL', cidade: 'CESÁRIO LANGE', uf: 'SP' })
    delete process.env.ADMISSION_EMPLOYERS_BY_UNIT
  })

  it('exige as respostas do termo PCD só de quem se declarou PCD', () => {
    expect(missingPcdAnswers({ disability: 'Não' })).toEqual([])
    expect(missingPcdAnswers({ disability: 'Sim', pcdReport: 'Sim, possuo' })).toHaveLength(5)
  })

  it('gera todos os documentos a partir dos formulários originais', async () => {
    const ctx = buildFormContext(admission, { cpf: '12345678909', disability: 'Não', city: 'Guarulhos - SP', state: 'SP' }, { cbo: '223505' })
    const pages: Record<string, number> = {}
    for (const layout of ADMISSION_LAYOUTS) {
      if (layout.appliesTo && !layout.appliesTo(ctx)) continue
      const bytes = await (await layout.render(ctx)).save()
      pages[layout.key] = (await PDFDocument.load(bytes)).getPageCount()
    }
    expect(pages).toEqual({
      contrato_trabalho: 4, ficha_registro: 2, termo_recursos_tecnologicos: 2, termo_ciencia_ponto: 1, termo_ciencia_atestados: 1, termo_uso_celular: 1,
      termo_uso_imagem_voz: 2, termo_desconto_folha: 2, termo_programa_imunizacao: 2, termo_banco_horas: 1, termo_vale_transporte: 1, regimento_interno: 27,
    })
    const pcd = buildFormContext(admission, { disability: 'Sim', pcdType: 'Auditiva' })
    const termoPcd = ADMISSION_LAYOUTS.find((layout) => layout.key === 'termo_pcd')!
    expect(termoPcd.appliesTo!(pcd)).toBe(true)
    expect((await PDFDocument.load(await (await termoPcd.render(pcd)).save())).getPageCount()).toBe(2)
  }, 30000)
})
