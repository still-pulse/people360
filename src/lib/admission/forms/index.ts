import type { PDFDocument } from 'pdf-lib'
import type { FormContext } from './context'
import { renderContract } from './contract'
import { renderEmployeeRecord } from './employeeRecord'
import { renderTerm, TERM_FORMS } from './terms'

// Documentos da admissão gerados a partir dos formulários oficiais (PDF original + dados do colaborador).
// A chave é a mesma do DocumentTemplate: o registro no banco guarda nome/versão e o vínculo com os
// documentos gerados; o conteúdo (layout) vem daqui, não do texto do template.

export type AdmissionLayout = {
  key: string; name: string; version: number; code: string
  appliesTo?: (ctx: FormContext) => boolean
  render: (ctx: FormContext) => Promise<PDFDocument>
}

/** Versão dos templates de layout (acima das versões em texto, para substituí-las). */
export const LAYOUT_VERSION = 10

export const ADMISSION_LAYOUTS: AdmissionLayout[] = [
  { key: 'contrato_trabalho', name: 'Contrato Individual de Trabalho e Documentos Admissionais - BHCL', version: 12, code: 'Contrato Individual de Trabalho', render: renderContract },
  { key: 'ficha_registro', name: 'Ficha de Empregado', version: 12, code: 'Registro de Empregado', render: renderEmployeeRecord },
  ...TERM_FORMS.map((form): AdmissionLayout => ({
    key: form.key, name: form.name, version: form.version ?? LAYOUT_VERSION, code: form.code, appliesTo: form.appliesTo,
    render: (ctx) => renderTerm(form, ctx),
  })),
]

export const layoutByKey = (key: string) => ADMISSION_LAYOUTS.find((layout) => layout.key === key) ?? null

/** Texto guardado no DocumentTemplate de um layout (descritivo; o PDF é montado pelo código). */
export function layoutTemplateContent(layout: AdmissionLayout) {
  return `Documento oficial ${layout.code} — ${layout.name}.\nGerado a partir do formulário original (assets/admission-forms) com os dados do colaborador preenchidos automaticamente. Este texto não é editável pela tela de Modelos.`
}
