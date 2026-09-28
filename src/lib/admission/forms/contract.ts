import type { PDFDocument } from 'pdf-lib'
import { reaisPorExtenso } from './extenso'
import { dmy, experiencePeriods, longDate, money, upper, type FormContext } from './context'
import { drawLine, drawParagraph, embedFonts, loadForm } from './pdfText'

// Contrato de Experiência + relatórios admissionais (6 páginas), no layout do modelo
// "Exemplo de Contrato - Relatórios Admissionais". O modelo em branco (assets/admission-forms/contrato-experiencia.pdf)
// é o exemplo original sem os dados da pessoa; as coordenadas abaixo são as do exemplo.

export const CONTRACT_FORM_FILE = 'contrato-experiencia.pdf'

/** CTPS não é coletada na admissão digital: sai em branco para o DP completar. */
const CTPS_BLANK = '__________/_____'

/** Turnos de 12 horas são escala 12x36; os demais, jornada de segunda a sexta. */
function workDays(schedule: string) {
  const hours = /(\d{1,2}):(\d{2})\s*às\s*(\d{1,2}):(\d{2})/.exec(schedule)
  if (!hours) return 'Segunda à Sexta'
  const start = Number(hours[1]) * 60 + Number(hours[2]), end = Number(hours[3]) * 60 + Number(hours[4])
  const duration = (end - start + 24 * 60) % (24 * 60)
  return duration >= 11 * 60 ? 'Escala 12x36' : 'Segunda à Sexta'
}

export async function renderContract(ctx: FormContext): Promise<PDFDocument> {
  const pdf = await loadForm(CONTRACT_FORM_FILE)
  const fonts = await embedFonts(pdf)
  const [p1, p2, p3, p4, p5, p6] = pdf.getPages()
  const { employer: emp, person, address, job } = ctx
  const periods = experiencePeriods(job.hireDate, job.experienceDays)
  const hireLong = longDate(job.hireDate)
  const placeAndDate = `${emp.cidade}, ${hireLong}.`
  const courier = { font: fonts.courier, size: 10 }
  const addressLine = [address.street, address.number].filter(Boolean).join(', ')

  // ── Página 1: contrato de experiência (Courier 10, 90 colunas) ──
  const width = 541.5, leading = 10.57
  drawParagraph(p1,
    `Pelo presente instrumento particular de Contrato de Experiência, a empresa ${emp.nome} com sede à  ${emp.logradouro} ${emp.bairro} Cidade ${emp.cidade} Estado ${emp.uf}, inscrita no CNPJ do MF sob Nº ${emp.cnpj}, denominada Empregadora, E O SR.(A) ${person.name}, DOMICILIADO À ${upper(address.street || '')}, PORTADOR DA CTPS Nº/SÉRIE ${CTPS_BLANK} DORAVANTE CHAMADO EMPREGADO, FICA JUSTO E ACERTADO O PRESENTE CONTRATO INDIVIDUAL DE TRABALHO, REGIDO PELAS SEGUINTES CLAUSULAS:`,
    15.7, 36.3, width, { ...courier, leading, maxLines: 7, indent: '   ', justify: true })
  drawParagraph(p1,
    `1 - O Empregado trabalhará para a Empregadora na função de ${upper(job.title)} e mais as funções que vierem a ser objeto de ordens verbais, cartas ou avisos, segundo as necessidades da Empregadora desde que compatíveis com suas atribuições.`,
    15.7, 124.1, width, { ...courier, leading, maxLines: 3, justify: true })
  // Tabela do horário (Arial 9 no original).
  drawLine(p1, workDays(job.schedule), 47.2, 263.9, { font: fonts.regular, size: 9 })
  drawLine(p1, job.schedule, 199.65, 263.9, { font: fonts.regular, size: 9, align: 'center' })
  drawLine(p1, job.breakSchedule, 322.65, 263.9, { font: fonts.regular, size: 9, align: 'center' })
  const salary = job.salary ?? 0
  drawParagraph(p1, `4 - O Empregado perceberá a remuneração de: R$ ${money(salary)} por Mês(${reaisPorExtenso(salary)} ).`, 15.7, 370.9, width, { ...courier, leading, maxLines: 2, justify: true })
  drawParagraph(p1, `5 - O prazo deste contrato é de ${periods.first} dias, com inicio em ${dmy(job.hireDate)} e término em ${dmy(periods.firstEnd)}.`, 15.7, 397.1, width, { ...courier, leading, maxLines: 1 })
  drawLine(p1, placeAndDate, 15.7, 609.3, courier)
  for (const top of [643.9, 769.1]) {
    drawLine(p1, emp.nome, 137.85, top, { ...courier, align: 'center', maxWidth: 240 })
  }
  for (const top of [644.6, 769.8]) drawLine(p1, person.name, 434.85, top, { ...courier, align: 'center', maxWidth: 240 })
  drawLine(p1, `Por mútuo acordo, o presente contrato de experiência fica prorrogado até ${periods.totalEnd ? dmy(periods.totalEnd) : '___/___/_____'}.`, 15.7, 718.8, courier)

  // ── Página 2: declaração de encargos de família para IR (Tahoma 7,4 → Helvetica) ──
  const t74 = { font: fonts.regular, size: 7.4 }
  drawLine(p2, `Empresa: ${emp.nome}`, 17.6, 43.2, t74)
  drawLine(p2, `C.N.P.J: ${emp.cnpj.replace(/\D/g, '')}`, 17.6, 55.8, t74)
  drawLine(p2, ` ${emp.logradouro}, ${emp.bairro.slice(0, 20).trim()}`, 17.6, 68.6, t74)
  const irDependents = ctx.dependents.filter((dependent) => dependent.irrf)
  irDependents.slice(0, 12).forEach((dependent, index) => {
    const top = 193.3 + index * 11.3
    drawLine(p2, String(index + 1), 17.6, top, t74)
    drawLine(p2, dependent.name, 40.9, top, { ...t74, maxWidth: 205 })
    drawLine(p2, dependent.relationship, 254.5, top, { ...t74, maxWidth: 225 })
    drawLine(p2, dmy(dependent.birthDate), 548.0, top, { ...t74, align: 'right' })
  })
  drawLine(p2, placeAndDate, 17.6, 399.2, t74)
  drawLine(p2, person.name, 431.05, 443.3, { ...t74, align: 'center', maxWidth: 270 })
  drawLine(p2, `Declarante: ${person.name}`, 19.0, 500.7, { ...t74, maxWidth: 258 })
  drawLine(p2, `Endereço: ${addressLine}`, 19.0, 512.0, { ...t74, maxWidth: 258 })
  drawLine(p2, `CEP: ${address.zipCode} Cidade: ${upper(address.city)} - ${address.state}`, 19.0, 523.3, { ...t74, maxWidth: 258 })
  drawLine(p2, `Estado Civil: ${person.maritalStatus}  Carteira: ________ série _____`, 19.0, 534.6, { ...t74, maxWidth: 258 })
  drawLine(p2, `CPF: ${person.cpf}`, 19.0, 545.9, t74)

  // ── Página 3: ficha de salário-família (Tahoma 6,2) ──
  const t62 = { font: fonts.regular, size: 6.2 }
  drawLine(p3, `Empresa:    ${emp.nome}`, 4.1, 54.7, t62)
  drawLine(p3, `Endereço:   ${emp.logradouro.replace(/,.*$/, '')}`, 4.1, 64.2, t62)
  drawLine(p3, `Cidade:       ${emp.cidade} - ${emp.uf}`, 4.1, 73.7, t62)
  drawLine(p3, `C.N.P.J:      ${emp.cnpj}`, 4.1, 83.1, t62)
  drawLine(p3, `Nome do Empregado: ${person.name}`, 4.1, 103.3, t62)
  drawLine(p3, 'CTPS/Série:', 4.1, 112.8, t62)
  drawLine(p3, `Data de admissão:     ${hireLong}.`, 4.1, 122.3, t62)
  const children = ctx.dependents.filter((dependent) => dependent.under14)
  children.slice(0, 20).forEach((child, index) => {
    const top = 183.2 + index * 9.5
    drawLine(p3, String(index + 1), 34.4, top, { ...t62, align: 'right' })
    drawLine(p3, child.name, 36.1, top, { ...t62, maxWidth: 155 })
    drawLine(p3, dmy(child.birthDate), 195.5, top, t62)
  })
  drawLine(p3, person.name, 110.0, 438.2, { ...t62, align: 'center', maxWidth: 210 })

  // ── Página 4: termo de responsabilidade do salário-família (Tahoma 7,4) ──
  drawLine(p4, `EMPRESA: ${emp.nome}`, 17.6, 65.0, t74)
  drawLine(p4, `CNPJ: ${emp.cnpj}`, 17.6, 76.3, t74)
  drawLine(p4, person.name, 102.2, 101.7, t74)
  drawLine(p4, 'CTPS/SÉRIE:', 17.6, 114.3, t74)
  children.slice(0, 14).forEach((child, index) => {
    const top = 170.1 + index * 11.3
    drawLine(p4, child.name, 17.6, top, { ...t74, maxWidth: 440 })
    drawLine(p4, dmy(child.birthDate), 525.5, top, { ...t74, align: 'right' })
  })
  drawLine(p4, placeAndDate, 17.6, 486.0, t74)
  drawLine(p4, person.name, 163.2, 556.2, { ...t74, align: 'center', maxWidth: 280 })

  // ── Página 5: registro de empregado (Arial 8) ──
  const a8 = { font: fonts.regular, size: 8 }
  drawLine(p5, emp.nome, 155.2, 64.7, { ...a8, maxWidth: 310 })
  drawLine(p5, emp.cnpj, 473.2, 65.0, a8)
  drawLine(p5, `${emp.logradouro}, ${emp.bairro.slice(0, 20).trim()}, ${emp.cidade}, ${emp.uf},`, 155.2, 88.7, { ...a8, maxWidth: 400 })
  drawLine(p5, person.name, 9.7, 114.1, { ...a8, maxWidth: 272 })
  const residence = [addressLine, address.complement, address.district, upper(address.city), address.state].filter(Boolean).join(', ')
  drawLine(p5, `${residence},`, 9.0, 134.7, { ...a8, maxWidth: 272 })
  drawLine(p5, ` - CEP: ${address.zipCode}`, 9.0, 143.7, a8)
  drawLine(p5, ctx.dependents.map((dependent) => dependent.name).join(', '), 293.2, 113.7, { ...a8, maxWidth: 270 })
  drawLine(p5, person.birthDate, 101.2, 167.4, a8)
  drawLine(p5, person.birthPlace, 197.2, 167.4, { ...a8, maxWidth: 200 })
  drawLine(p5, person.nationality, 411.0, 167.4, { ...a8, maxWidth: 85 })
  drawLine(p5, person.maritalStatus, 504.0, 167.4, { ...a8, maxWidth: 62 })
  drawLine(p5, person.fatherName, 148.4, 183.5, { ...a8, maxWidth: 410 })
  drawLine(p5, person.motherName, 148.4, 200.0, { ...a8, maxWidth: 410 })
  drawLine(p5, person.rg, 101.2, 216.9, { ...a8, maxWidth: 92 })
  drawLine(p5, person.rgIssuedAt, 198.0, 216.9, a8)
  drawLine(p5, person.rgIssuer, 259.4, 216.9, { ...a8, maxWidth: 66 })
  drawLine(p5, person.voterTitle, 333.0, 216.9, { ...a8, maxWidth: 95 })
  drawLine(p5, person.voterZone, 435.7, 216.9, { ...a8, maxWidth: 28 })
  drawLine(p5, person.voterSection, 468.7, 216.9, { ...a8, maxWidth: 28 })
  drawLine(p5, person.cpf, 333.0, 233.7, a8)
  drawLine(p5, person.ethnicity, 242.2, 249.9, { ...a8, maxWidth: 95 })
  drawLine(p5, person.gender, 345.0, 249.9, { ...a8, maxWidth: 60 })
  drawLine(p5, person.education, 411.0, 249.9, { ...a8, maxWidth: 158 })
  drawLine(p5, person.disability ? 'Sim' : 'Não', 104.2, 266.4, a8)
  drawLine(p5, person.phone, 435.7, 266.4, { ...a8, maxWidth: 130 })
  drawLine(p5, upper(job.title), 103.4, 282.5, { ...a8, maxWidth: 208 })
  drawLine(p5, job.cbo, 519.7, 283.3, a8)
  drawLine(p5, dmy(job.hireDate), 8.2, 305.0, a8)
  drawLine(p5, 'R$', 102.0, 305.0, a8)
  drawLine(p5, money(salary), 194.9, 305.0, { ...a8, align: 'right' })
  drawLine(p5, 'Mês', 203.2, 305.0, a8)
  drawLine(p5, job.schedule ? `das ${job.schedule.replace(' às ', ' as ')}` : '', 269.2, 304.7, a8)
  drawLine(p5, job.breakSchedule ? `das ${job.breakSchedule.replace(' às ', ' as ')}` : '', 432.7, 304.7, a8)
  drawLine(p5, dmy(job.hireDate), 55.4, 324.5, a8)
  drawLine(p5, person.pis, 78.7, 354.5, a8)
  drawLine(p5, person.name, 467.55, 737.7, { ...a8, align: 'center', maxWidth: 230 })

  // ── Página 6: informações do contrato de prazo determinado (Arial 7) ──
  const a7 = { font: fonts.regular, size: 7 }
  drawLine(p6, 'Nº:', 473.2, 10.9, a7)
  drawLine(p6, emp.nome, 7.4, 23.6, a7)
  drawLine(p6, `CNPJ: ${emp.cnpj}`, 473.2, 23.6, a7)
  drawLine(p6, person.name, 7.4, 36.5, a7)
  const row = [dmy(job.hireDate), dmy(periods.firstEnd), periods.extension ? String(periods.extension) : '', periods.totalEnd ? dmy(periods.totalEnd) : '', String(periods.first), 'Sim']
  const centers = [46.8, 140.5, 234.25, 328.0, 421.85, 515.55]
  row.forEach((value, index) => drawLine(p6, value, centers[index], 82.2, { ...a7, align: 'center' }))

  return pdf
}
