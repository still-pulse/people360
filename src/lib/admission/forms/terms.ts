import { PDFDocument, rgb } from 'pdf-lib'
import { dmy, money, type FormContext } from './context'
import { drawCheck, drawDot, drawLine, embedFonts, loadForm, type Fonts } from './pdfText'
import type { PDFPage } from 'pdf-lib'

// Termos institucionais (FP.RH / RI.RH / RH-PCD): o PDF original recebe os dados do colaborador por cima.
// Coordenadas medidas nos formulários: `top` é a linha de base a partir do topo da página.

type Cell = { x: number; top: number; width: number }
/** Cabeçalho "1. Dados do Colaborador" + célula "Data" da assinatura, comum aos formulários FP.RH. */
type HeaderLayout = { nome: Cell; unidade: Cell; cargo: Cell; setor: Cell; data: Cell }

const header = (nomeTop: number, linha2Top: number, dataTop: number, x = [50.5, 237.9, 433.1], widths = [364, 172, 180, 110]): HeaderLayout => ({
  nome: { x: x[0], top: nomeTop, width: widths[0] },
  unidade: { x: x[0], top: linha2Top, width: widths[1] },
  cargo: { x: x[1], top: linha2Top, width: widths[2] },
  setor: { x: x[2], top: linha2Top, width: widths[3] },
  data: { x: x[0], top: dataTop, width: 240 },
})

function fillHeader(page: PDFPage, layout: HeaderLayout, ctx: FormContext, fonts: Fonts, size = 9) {
  const style = (cell: Cell) => ({ font: fonts.regular, size, maxWidth: cell.width })
  drawLine(page, ctx.person.name, layout.nome.x, layout.nome.top, style(layout.nome))
  drawLine(page, ctx.job.unit, layout.unidade.x, layout.unidade.top, style(layout.unidade))
  drawLine(page, ctx.job.title, layout.cargo.x, layout.cargo.top, style(layout.cargo))
  drawLine(page, ctx.job.department, layout.setor.x, layout.setor.top, style(layout.setor))
  drawLine(page, dmy(ctx.issuedAt), layout.data.x, layout.data.top, style(layout.data))
}

export type TermForm = {
  key: string; name: string; code: string; file: string
  /** Versão interna do layout; permite atualizar um termo sem recriar todos os outros. */
  version?: number
  /** Só gera para quem se aplica (ex.: termo PCD). */
  appliesTo?: (ctx: FormContext) => boolean
  fill: (pdf: PDFDocument, ctx: FormContext, fonts: Fonts) => Promise<void> | void
}

const simpleTerm = (key: string, name: string, code: string, file: string, layout: HeaderLayout): TermForm => ({
  key, name, code, file,
  fill: (pdf, ctx, fonts) => fillHeader(pdf.getPage(0), layout, ctx, fonts),
})

/** Cabeçalho dos novos formulários FP.RH: nome/CPF/matrícula e unidade/cargo/setor. */
const institutionalHeader: Omit<HeaderLayout, 'data'> & { cpf: Cell; registration: Cell } = {
  nome: { x: 48.05, top: 93.08, width: 244.83 },
  cpf: { x: 304.15, top: 93.08, width: 116.37 },
  registration: { x: 431.05, top: 93.08, width: 116.4 },
  unidade: { x: 48.05, top: 126.87, width: 177.25 },
  cargo: { x: 235.8, top: 126.87, width: 184.72 },
  setor: { x: 431.05, top: 126.87, width: 116.4 },
}

function institutionalTerm(key: string, name: string, code: string, file: string, dateTop: number): TermForm {
  return {
    key, name, code, file, version: 11,
    fill: (pdf, ctx, fonts) => {
      const page = pdf.getPage(0)
      const style = (cell: Cell) => ({ font: fonts.regular, size: 9, maxWidth: cell.width })
      drawLine(page, ctx.person.name, institutionalHeader.nome.x, institutionalHeader.nome.top, style(institutionalHeader.nome))
      drawLine(page, ctx.person.cpf, institutionalHeader.cpf.x, institutionalHeader.cpf.top, style(institutionalHeader.cpf))
      drawLine(page, ctx.person.registration, institutionalHeader.registration.x, institutionalHeader.registration.top, style(institutionalHeader.registration))
      drawLine(page, ctx.job.unit, institutionalHeader.unidade.x, institutionalHeader.unidade.top, style(institutionalHeader.unidade))
      drawLine(page, ctx.job.title, institutionalHeader.cargo.x, institutionalHeader.cargo.top, style(institutionalHeader.cargo))
      drawLine(page, ctx.job.department, institutionalHeader.setor.x, institutionalHeader.setor.top, style(institutionalHeader.setor))
      drawLine(pdf.getPage(1), dmy(ctx.issuedAt), 48.05, dateTop, { font: fonts.regular, size: 10, maxWidth: 251.58 })
    },
  }
}

export const TERM_FORMS: TermForm[] = [
  institutionalTerm('termo_recursos_tecnologicos', 'Termo de Confidencialidade e Sigilo Profissional', 'FP.RH.01.004-01', 'FP.RH.01.004-termo-recursos-tecnologicos.pdf', 570.53),
  { ...simpleTerm('termo_ciencia_ponto', 'Termo de Ciência — Controle de Ponto', 'FP.RH.01.006-00', 'FP.RH.01.006-termo-ciencia-ponto.pdf', header(100.3, 137.7, 779.6)), version: 11 },
  {
    key: 'termo_ciencia_atestados', name: 'Termo de Ciência — Apresentação e Comunicação de Atestados Médicos', code: 'FP.RH.01.007', file: 'FP.RH.01.007-termo-ciencia-atestados.pdf',
    fill: (pdf, ctx, fonts) => {
      const page = pdf.getPage(0), style = { font: fonts.regular, size: 9.5 }
      drawLine(page, ctx.employer.cnpj, 334.0, 88.8, style)
      drawLine(page, ctx.person.name, 49.0, 117.6, { ...style, maxWidth: 275 })
      drawLine(page, ctx.person.cpf, 417.9, 117.6, style)
      drawLine(page, ctx.job.unit, 49.0, 144.4, { ...style, maxWidth: 275 })
      drawLine(page, ctx.job.department, 335.5, 144.4, { ...style, maxWidth: 212 })
      drawLine(page, dmy(ctx.issuedAt), 78.0, 757.8, { font: fonts.regular, size: 10.6 })
    },
  },
  simpleTerm('termo_uso_celular', 'Termo de Ciência e Compromisso de Conduta Profissional — Uso de Celular', 'FP.RH.01.008', 'FP.RH.01.008-termo-uso-celular.pdf', header(100.3, 137.7, 759.8)),
  institutionalTerm('termo_uso_imagem_voz', 'Termo de Ciência e Adesão à Política de Uso de Imagem, Voz, Nome e Videomonitoramento', 'FP.RH.01.011-00', 'FP.RH.01.011-termo-uso-imagem-voz.pdf', 333.3),
  institutionalTerm('termo_desconto_folha', 'Termo de Autorização de Desconto em Folha de Pagamento', 'FP.RH.01.015-00', 'FP.RH.01.015-termo-desconto-folha.pdf', 582.52),
  institutionalTerm('termo_programa_imunizacao', 'Termo de Ciência e Adesão ao Programa de Imunização', 'FP.RH.01.016-00', 'FP.RH.01.016-termo-programa-imunizacao.pdf', 325.8),
  simpleTerm('termo_banco_horas', 'Termo de Ciência — Política de Banco de Horas', 'FP.RH.01.013', 'FP.RH.01.013-termo-banco-horas.pdf', header(131.5, 176.0, 715.8, [47.5, 239.4, 433.8], [368, 176, 180, 112])),
  {
    key: 'termo_vale_transporte', name: 'Opção do Vale-Transporte', code: 'FP.RH.04', file: 'FP.RH.04-opcao-vale-transporte.pdf',
    fill: (pdf, ctx, fonts) => {
      const page = pdf.getPage(0), style = { font: fonts.regular, size: 9 }
      fillHeader(page, header(101.4, 139.0, 761.5), ctx, fonts)
      const a = ctx.address
      drawLine(page, a.street, 50.5, 176.5, { ...style, maxWidth: 365 })
      drawLine(page, a.number, 433.0, 176.5, { ...style, maxWidth: 110 })
      drawLine(page, a.complement, 50.5, 208.6, { ...style, maxWidth: 252 })
      drawLine(page, a.district, 319.6, 208.6, { ...style, maxWidth: 225 })
      drawLine(page, a.city, 50.5, 240.7, { ...style, maxWidth: 168 })
      drawLine(page, a.state, 234.6, 240.7, style)
      drawLine(page, a.zipCode, 433.0, 240.7, style)
      if (ctx.transport.requested === true) drawCheck(page, 53.4, 272.6, fonts.bold, 9)
      if (ctx.transport.requested === false) drawCheck(page, 321.9, 272.6, fonts.bold, 9)
      const routes = ctx.transport.routes.slice(0, 8)
      routes.forEach((route, index) => {
        const offset = index * 33.87
        if (route.outbound > 0) drawCheck(page, 77.6, 319.4 + offset, fonts.bold, 8.5)
        if (route.returnValue > 0) drawCheck(page, 114.9, 319.4 + offset, fonts.bold, 8.5)
        drawLine(page, route.line, 170.8, 323.9 + offset, { ...style, maxWidth: 133 })
        const ticket = route.outbound > 0 && route.returnValue > 0 && route.outbound !== route.returnValue
          ? `R$ ${money(route.outbound)} / R$ ${money(route.returnValue)}`
          : `R$ ${money(route.outbound || route.returnValue)}`
        drawLine(page, ticket, 433.0, 323.9 + offset, { ...style, maxWidth: 110 })
      })
      if (routes.length) {
        const legs = routes.reduce((total, route) => total + (route.outbound > 0 ? 1 : 0) + (route.returnValue > 0 ? 1 : 0), 0)
        const daily = routes.reduce((total, route) => total + route.outbound + route.returnValue, 0)
        drawLine(page, String(legs), 50.5, 596.0, style)
        drawLine(page, `R$ ${money(daily)}`, 319.6, 596.0, style)
      }
    },
  },
  {
    key: 'regimento_interno', name: 'Regimento Interno de Pessoal — Termo de Ciência e Recebimento', code: 'RI.RH.001', file: 'RI.RH.001-anexo-1-termo-recebimento.pdf',
    fill: async (pdf, ctx, fonts) => {
      const page = pdf.getPage(0)
      fillHeader(page, header(176.3, 210.7, 584.4, [64.7, 241.6, 426.0], [352, 170, 178, 118]), ctx, fonts)
      drawCheck(page, 103.7, 481.8, fonts.bold, 9) // cópia recebida em meio Digital
      // O regimento completo acompanha o termo: é a cópia entregue ao colaborador.
      const regimento = await loadForm('RI.RH.001-regimento-interno.pdf')
      const pages = await pdf.copyPages(regimento, regimento.getPageIndices())
      for (const copied of pages) pdf.addPage(copied)
    },
  },
  {
    key: 'termo_pcd', name: 'Termo de Autodeclaração — Pessoa com Deficiência (PCD)', code: 'RH-PCD-001', file: 'RH-PCD-001-autodeclaracao-pcd.pdf',
    appliesTo: (ctx) => ctx.person.disability,
    fill: (pdf, ctx, fonts) => fillPcd(pdf, ctx, fonts),
  },
]

const NAVY = rgb(0x1c / 255, 0x35 / 255, 0x57 / 255)

/** Posição (centro do "o") de cada opção do termo PCD, pela resposta dada no portal. */
const PCD_OPTIONS: Record<string, Record<string, [number, number]>> = {
  pcdReport: { 'Sim, possuo': [306.9, 283.6], 'Ainda não possuo': [386.6, 283.6], 'Não possuo': [488.7, 283.6] },
  pcdType: {
    'Física': [43.1, 342.7], 'Auditiva': [43.1, 354.4], 'Visual': [43.1, 366.1], 'Intelectual': [43.1, 377.9],
    'Transtorno Espectro Autista (TEA)': [43.1, 389.7], 'Múltipla': [43.1, 401.4], 'Outra': [43.1, 413.2],
  },
  pcdDegree: { 'Leve': [308.2, 342.7], 'Moderada': [308.2, 354.4], 'Grave': [308.2, 366.1], 'Não definido / Não se aplica': [308.2, 377.9] },
  pcdShareReport: { 'Sim, autorizo': [43.1, 483.8], 'Não autorizo no momento': [125.8, 483.8] },
  pcdSupport: { 'Sim, solicito orientação': [306.9, 483.8], 'Não é necessário': [429.4, 483.8] },
}

function fillPcd(pdf: PDFDocument, ctx: FormContext, fonts: Fonts) {
  const page = pdf.getPage(0), style = { font: fonts.regular, size: 9 }
  drawLine(page, ctx.person.name, 44.3, 152.5, { ...style, maxWidth: 500 })
  drawLine(page, ctx.person.cpf ? `— / ${ctx.person.cpf}` : '', 44.3, 187.5, { ...style, maxWidth: 155 })
  drawLine(page, ctx.job.title, 207.9, 187.5, { ...style, maxWidth: 176 })
  drawLine(page, [ctx.job.unit, ctx.job.department].filter(Boolean).join(' / '), 392.0, 187.5, { ...style, maxWidth: 170 })
  drawDot(page, 43.1, 283.6, NAVY) // 1. Sim, me autodeclaro PCD
  for (const [key, options] of Object.entries(PCD_OPTIONS)) {
    const position = options[ctx.pcd[key]]
    if (position) drawDot(page, position[0], position[1], NAVY)
  }
  if (ctx.pcd.pcdType === 'Outra' && ctx.person.disabilityDetails) drawLine(page, ctx.person.disabilityDetails, 80.0, 415.2, { font: fonts.regular, size: 8, maxWidth: 210 })
  // Data ao lado da assinatura do colaborador: "DATA: ______ / ______ / ____________".
  const [day, month, year] = dmy(ctx.issuedAt).split('/')
  const bold8 = (text: string) => fonts.bold.widthOfTextAtSize(text, 8)
  const start = 371.7 + bold8('DATA: ')
  const blanks = [['______', day], [' / ______', month], [' / ____________', year]] as const
  let cursor = start
  for (const [blank, value] of blanks) {
    const gap = blank.startsWith(' / ') ? bold8(' / ') : 0
    const width = bold8(blank.replace(' / ', ''))
    drawLine(page, value, cursor + gap + width / 2, 596.3, { font: fonts.regular, size: 8.5, align: 'center' })
    cursor += gap + width
  }
  // Verso: ciência dos benefícios (texto branco sobre a faixa escura).
  const back = pdf.getPage(1)
  const benefit = ctx.pcd.pcdBenefits
  if (benefit === 'Estou ciente e não tenho dúvidas') drawDot(back, 46.5, 542.1, rgb(1, 1, 1))
  if (benefit === 'Solicito orientação complementar do RH') {
    const x = 44.0 + fonts.regular.widthOfTextAtSize('o  Estou ciente e não tenho dúvidas               ', 9)
    drawDot(back, x + 2.5, 542.1, rgb(1, 1, 1))
  }
}

export async function renderTerm(form: TermForm, ctx: FormContext) {
  const pdf = await loadForm(form.file)
  const fonts = await embedFonts(pdf)
  await form.fill(pdf, ctx, fonts)
  return pdf
}
