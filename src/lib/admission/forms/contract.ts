import { rgb, type PDFDocument, type PDFPage } from 'pdf-lib'
import { reaisPorExtenso } from './extenso'
import { dmy, experiencePeriods, money, upper, type FormContext } from './context'
import { drawParagraph, embedFonts, loadForm, replaceLine, type Fonts } from './pdfText'

// Novo modelo oficial "Contrato Individual de Trabalho e Documentos Admissionais - BHCL".
// O PDF-base mantém a diagramação recebida; os marcadores são apagados e substituídos pelos dados da admissão.
export const CONTRACT_FORM_FILE = 'contrato-individual-trabalho-bhcl.pdf'

function workDays(schedule: string) {
  const hours = /(\d{1,2}):?(\d{2}).*?(\d{1,2}):?(\d{2})/.exec(schedule)
  if (!hours) return 'SEGUNDA A SEXTA'
  const start = Number(hours[1]) * 60 + Number(hours[2]), end = Number(hours[3]) * 60 + Number(hours[4])
  return (end - start + 1440) % 1440 >= 660 ? 'ESCALA 12X36' : 'SEGUNDA A SEXTA'
}

function field(page: PDFPage, value: string, x: number, pdfY: number, width: number, fonts: Fonts, size = 9.75) {
  replaceLine(page, value, x, page.getHeight() - pdfY, width, { font: fonts.regular, size })
}

function paragraph(page: PDFPage, value: string, x: number, pdfY: number, width: number, lines: number, fonts: Fonts, size = 8.25) {
  const leading = 10.4
  page.drawRectangle({ x: x - 1, y: pdfY - (lines - 1) * leading - 4, width: width + 2, height: (lines - 1) * leading + size + 7, color: rgb(1, 1, 1) })
  drawParagraph(page, value, x, page.getHeight() - pdfY, width, { font: fonts.courier, size, leading, maxLines: lines, justify: true })
}

export async function renderContract(ctx: FormContext): Promise<PDFDocument> {
  const pdf = await loadForm(CONTRACT_FORM_FILE)
  const fonts = await embedFonts(pdf)
  const [p1, p2, p3, p4] = pdf.getPages()
  const { employer, person, address, job } = ctx
  const periods = experiencePeriods(job.hireDate, job.experienceDays)
  const fullAddress = [address.street, address.number, address.complement, address.district, address.city, address.state, address.zipCode].filter(Boolean).join(', ')
  const employerAddress = [employer.logradouro, employer.bairro, employer.cidade, employer.uf].filter(Boolean).join(', ')
  const representative = [employer.representative, employer.representativeTitle].filter(Boolean).join(' - ')

  // Página 1 — qualificação, cargo, vigência e local de trabalho.
  paragraph(p1,
    `Vila Brasil, CEP 18.285-000, Cesário Lange/SP, representada por ${representative || 'seu representante legal'}, doravante EMPREGADORA; e, de outro, ${person.name}, ${person.nationality}, ${person.maritalStatus}, RG nº ${person.rg}, CPF nº ${person.cpf}, NIT/PIS nº ${person.pis}, CTPS nº/série ${[person.ctps, person.ctpsSeries].filter(Boolean).join('/')}, registro profissional ${person.classRegistration}, residente em ${fullAddress}, e-mail ${person.email}, doravante EMPREGADO(A), ajustam o presente Contrato Individual de Trabalho, regido pela CLT, pela legislação complementar, pelas normas coletivas aplicáveis e pelas cláusulas seguintes:`,
    24.77, 757.42, 546, 7, fonts, 7.5)
  paragraph(p1,
    `1.1 O(A) EMPREGADO(A) é contratado(a) sob o regime da CLT para a função de ${upper(job.title)}, CBO nº ${job.cbo}, com lotação na unidade ${job.unit}, setor ${job.department}. As atribuições constam do Anexo I - Descrição do Cargo/Função e Atribuições.`,
    24.77, 662.08, 546, 3, fonts)
  paragraph(p1,
    `2.1 O contrato vigora por prazo indeterminado a partir de ${dmy(job.hireDate)}, precedido de experiência de ${periods.first} dias${periods.extension ? `, prorrogável por ${periods.extension} dias` : ''}, respeitado o limite de 90 dias (CLT, arts. 443, §2º, "c", e 445, parágrafo único). A prorrogação é única (art. 451; Anexo XVIII, quando aplicável).`,
    24.77, 518.7, 546, 4, fonts)
  paragraph(p1, `2.3 O prazo do contrato de experiência tem início em ${dmy(job.hireDate)} e término em ${dmy(periods.firstEnd)}.`, 24.77, 425.63, 546, 1, fonts)
  field(p1, '2 DIAS ÚTEIS', 65.33, 322.78, 82.6, fonts)
  paragraph(p1,
    `4.1 O trabalho é prestado na unidade indicada, em ${employerAddress}. Por necessidade do serviço, o(a) EMPREGADO(A) poderá ser designado(a) para cobertura ou remanejamento entre unidades do mesmo município ou região metropolitana, sem mudança de domicílio, custeando a EMPREGADORA o acréscimo comprovado de deslocamento.`,
    24.77, 220.7, 546, 4, fonts)

  // Página 2 — jornada e remuneração.
  field(p2, workDays(job.schedule), 50.33, 746.17, 118, fonts, 9)
  field(p2, job.schedule, 200.5, 746.17, 112, fonts, 9)
  field(p2, job.breakSchedule, 340.17, 746.17, 112, fonts, 9)
  paragraph(p2, `6.1 Salário mensal de R$ ${job.salary == null ? '' : money(job.salary)} (${job.salary == null ? '' : reaisPorExtenso(job.salary)}), pago até o 5º dia útil do mês seguinte (CLT, art. 459, §1º), respeitado o piso legal ou normativo da categoria.`, 24.77, 695.88, 546, 2, fonts)

  // Página 3 — convenção, local e data.
  paragraph(p3, `13.1 O registro será feito no eSocial antes do início das atividades, com anotação na CTPS Digital (CLT, art. 29). Norma coletiva aplicável: ${process.env.ADMISSION_COLLECTIVE_AGREEMENT || ''}.`, 24.77, 575.75, 546, 2, fonts)
  paragraph(p3, `${employer.cidade}, ${dmy(ctx.issuedAt)}.`, 24.77, 474.42, 150, 1, fonts)

  // Página 4 — prorrogação do contrato de experiência.
  field(p4, periods.totalEnd ? dmy(periods.totalEnd) : '', 463.35, 791.95, 36, fonts)
  return pdf
}
