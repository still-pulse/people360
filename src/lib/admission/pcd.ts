// Perguntas do Termo de Autodeclaração PCD (RH-PCD-001). Os textos são os mesmos do formulário;
// o portal mostra estas perguntas quando o candidato informa que é pessoa com deficiência.
// Módulo sem dependências: usado pelo portal (cliente), pela API e pelo gerador do PDF.

export const PCD_QUESTIONS = [
  { key: 'pcdReport', label: 'Você possui laudo médico / relatório pericial?', options: ['Sim, possuo', 'Ainda não possuo', 'Não possuo'] },
  { key: 'pcdType', label: 'Tipo de deficiência', options: ['Física', 'Auditiva', 'Visual', 'Intelectual', 'Transtorno Espectro Autista (TEA)', 'Múltipla', 'Outra'] },
  { key: 'pcdDegree', label: 'Grau da deficiência', options: ['Leve', 'Moderada', 'Grave', 'Não definido / Não se aplica'] },
  { key: 'pcdShareReport', label: 'Autoriza compartilhar o laudo com o Médico do Trabalho?', options: ['Sim, autorizo', 'Não autorizo no momento'] },
  { key: 'pcdSupport', label: 'A empresa pode apoiar na articulação de acessibilidade?', options: ['Sim, solicito orientação', 'Não é necessário'] },
  { key: 'pcdBenefits', label: 'Ciência dos benefícios e direitos como PCD', options: ['Estou ciente e não tenho dúvidas', 'Solicito orientação complementar do RH'] },
] as const

export type PcdKey = typeof PCD_QUESTIONS[number]['key']
export const PCD_KEYS = PCD_QUESTIONS.map((question) => question.key) as PcdKey[]

/** Respostas que faltam (vazias ou fora das opções) para quem se declarou PCD. */
export function missingPcdAnswers(fields: Record<string, unknown>) {
  if (fields.disability !== 'Sim') return []
  return PCD_QUESTIONS.filter((question) => !(question.options as readonly string[]).includes(String(fields[question.key] ?? ''))).map((question) => question.label)
}
