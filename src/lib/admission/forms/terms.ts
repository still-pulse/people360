import { PDFDocument } from 'pdf-lib'
import { dmy, money, type FormContext } from './context'
import { drawCheck, drawLine, embedFonts, loadForm, type Fonts } from './pdfText'
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
type InstitutionalHeader = Omit<HeaderLayout, 'data'> & { cpf: Cell; registration: Cell }

const institutionalHeaderAt = (nameTop: number, line2Top: number): InstitutionalHeader => ({
  nome: { x: 48.05, top: nameTop, width: 244.83 },
  cpf: { x: 304.15, top: nameTop, width: 116.37 },
  registration: { x: 431.05, top: nameTop, width: 116.4 },
  unidade: { x: 48.05, top: line2Top, width: 177.25 },
  cargo: { x: 235.8, top: line2Top, width: 184.72 },
  setor: { x: 431.05, top: line2Top, width: 116.4 },
})

const institutionalHeader = institutionalHeaderAt(93.08, 126.87)

type InstitutionalOptions = { header?: InstitutionalHeader; datePage?: number }

function institutionalTerm(key: string, name: string, code: string, file: string, dateTop: number, options: InstitutionalOptions = {}): TermForm {
  const headerLayout = options.header ?? institutionalHeader
  return {
    key, name, code, file, version: 13,
    fill: (pdf, ctx, fonts) => {
      const page = pdf.getPage(0)
      const style = (cell: Cell) => ({ font: fonts.regular, size: 9, maxWidth: cell.width })
      drawLine(page, ctx.person.name, headerLayout.nome.x, headerLayout.nome.top, style(headerLayout.nome))
      drawLine(page, ctx.person.cpf, headerLayout.cpf.x, headerLayout.cpf.top, style(headerLayout.cpf))
      drawLine(page, ctx.person.registration, headerLayout.registration.x, headerLayout.registration.top, style(headerLayout.registration))
      drawLine(page, ctx.job.unit, headerLayout.unidade.x, headerLayout.unidade.top, style(headerLayout.unidade))
      drawLine(page, ctx.job.title, headerLayout.cargo.x, headerLayout.cargo.top, style(headerLayout.cargo))
      drawLine(page, ctx.job.department, headerLayout.setor.x, headerLayout.setor.top, style(headerLayout.setor))
      drawLine(pdf.getPage(options.datePage ?? 1), dmy(ctx.issuedAt), 48.05, dateTop, { font: fonts.regular, size: 10, maxWidth: 251.58 })
    },
  }
}

export const TERM_FORMS: TermForm[] = [
  { ...simpleTerm('termo_ciencia_ponto', 'Termo de Ciência do Controle de Ponto e Biometria', 'FP.RH.01.006-00', 'FP.RH.01.006-termo-ciencia-ponto.pdf', header(100.3, 137.7, 779.6)), version: 13 },
  institutionalTerm('termo_recursos_tecnologicos', 'Termo de Confidencialidade e Sigilo Profissional', 'FP.RH.01.004-01', 'FP.RH.01.004-termo-recursos-tecnologicos.pdf', 570.53),
  institutionalTerm('aviso_privacidade_empregado', 'Aviso de Privacidade do Empregado (LGPD)', 'FP.RH.01.017-00', 'ANEXO.05-aviso-privacidade-empregado.pdf', 664.5, { header: institutionalHeaderAt(104.25, 138), datePage: 0 }),
  institutionalTerm('termo_programa_imunizacao', 'Termo de Ciência e Adesão ao Programa de Imunização', 'FP.RH.01.016-00', 'FP.RH.01.016-termo-programa-imunizacao.pdf', 325.8),
  institutionalTerm('termo_codigo_conduta_anticorrupcao', 'Código de Conduta e Política Anticorrupção — Termo de Adesão', 'FP.RH.01.018-00', 'ANEXO.09-codigo-conduta-anticorrupcao.pdf', 587.25, { header: institutionalHeaderAt(104.25, 138), datePage: 0 }),
  institutionalTerm('termo_prevencao_assedio_discriminacao', 'Política de Prevenção e Combate ao Assédio e à Discriminação — Termo de Adesão', 'FP.RH.01.019-00', 'ANEXO.10-prevencao-assedio-discriminacao.pdf', 739.5, { header: institutionalHeaderAt(113.25, 147.75), datePage: 0 }),
  institutionalTerm('termo_uso_imagem_voz', 'Termo de Ciência e Adesão à Política de Uso de Imagem, Voz, Nome e Videomonitoramento', 'FP.RH.01.011-00', 'FP.RH.01.011-termo-uso-imagem-voz.pdf', 333.3),
  {
    key: 'termo_vale_transporte', name: 'Termo de Opção do Vale-Transporte', code: 'FP.RH.04', file: 'FP.RH.04-opcao-vale-transporte.pdf', version: 13,
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
  institutionalTerm('termo_desconto_folha', 'Termo de Autorização de Desconto em Folha de Pagamento', 'FP.RH.01.015-00', 'FP.RH.01.015-termo-desconto-folha.pdf', 582.52),
]

export async function renderTerm(form: TermForm, ctx: FormContext) {
  const pdf = await loadForm(form.file)
  const fonts = await embedFonts(pdf)
  await form.fill(pdf, ctx, fonts)
  return pdf
}
